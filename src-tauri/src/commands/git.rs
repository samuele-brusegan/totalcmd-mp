use git2::{
    BranchType, Cred, CredentialType, FetchOptions, IndexAddOption, ObjectType, PushOptions,
    RemoteCallbacks, Repository, Signature, Sort, StatusOptions,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct GitRepoInfo {
    pub root: String,
    pub branch: Option<String>,
    pub head: Option<String>,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub clean: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub index_status: String, // "new" | "modified" | "deleted" | "renamed" | "typechange" | "none"
    pub wt_status: String,
    pub staged: bool,
    pub conflicted: bool,
    pub ignored: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatusResult {
    pub info: GitRepoInfo,
    pub files: Vec<GitFileStatus>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommit {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub author: String,
    pub email: String,
    pub time: i64,
    pub parents: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub is_remote: bool,
    pub is_head: bool,
    pub upstream: Option<String>,
}

fn find_repo(path: &str) -> Result<Repository, String> {
    Repository::discover(Path::new(path)).map_err(|e| e.message().to_string())
}

fn status_to_strings(s: git2::Status) -> (String, String, bool) {
    let mut idx = "none";
    let mut wt = "none";
    let mut staged = false;

    if s.contains(git2::Status::INDEX_NEW) {
        idx = "new";
        staged = true;
    } else if s.contains(git2::Status::INDEX_MODIFIED) {
        idx = "modified";
        staged = true;
    } else if s.contains(git2::Status::INDEX_DELETED) {
        idx = "deleted";
        staged = true;
    } else if s.contains(git2::Status::INDEX_RENAMED) {
        idx = "renamed";
        staged = true;
    } else if s.contains(git2::Status::INDEX_TYPECHANGE) {
        idx = "typechange";
        staged = true;
    }

    if s.contains(git2::Status::WT_NEW) {
        wt = "new";
    } else if s.contains(git2::Status::WT_MODIFIED) {
        wt = "modified";
    } else if s.contains(git2::Status::WT_DELETED) {
        wt = "deleted";
    } else if s.contains(git2::Status::WT_RENAMED) {
        wt = "renamed";
    } else if s.contains(git2::Status::WT_TYPECHANGE) {
        wt = "typechange";
    }

    (idx.into(), wt.into(), staged)
}

#[tauri::command]
pub fn git_is_repo(path: String) -> Option<String> {
    Repository::discover(Path::new(&path))
        .ok()
        .and_then(|r| r.workdir().map(|w| w.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatusResult, String> {
    let repo = find_repo(&path)?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Bare repository".to_string())?
        .to_string_lossy()
        .to_string();

    let head_ref = repo.head().ok();
    let branch = head_ref
        .as_ref()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));
    let head_oid = head_ref.as_ref().and_then(|h| h.target().map(|o| o.to_string()));

    // Compute upstream + ahead/behind
    let mut upstream = None;
    let mut ahead = 0;
    let mut behind = 0;
    if let Some(name) = branch.as_deref() {
        if let Ok(local) = repo.find_branch(name, BranchType::Local) {
            if let Ok(up) = local.upstream() {
                if let Some(up_name) = up.name().ok().flatten() {
                    upstream = Some(up_name.to_string());
                }
                if let (Some(local_oid), Some(up_oid)) = (
                    local.get().target(),
                    up.get().target(),
                ) {
                    if let Ok((a, b)) = repo.graph_ahead_behind(local_oid, up_oid) {
                        ahead = a;
                        behind = b;
                    }
                }
            }
        }
    }

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.message().to_string())?;

    let mut files = Vec::new();
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();
        let (idx, wt, staged) = status_to_strings(s);
        let conflicted = s.contains(git2::Status::CONFLICTED);
        let ignored = s.contains(git2::Status::IGNORED);
        if idx == "none" && wt == "none" && !conflicted {
            continue;
        }
        files.push(GitFileStatus {
            path,
            index_status: idx,
            wt_status: wt,
            staged,
            conflicted,
            ignored,
        });
    }

    Ok(GitStatusResult {
        info: GitRepoInfo {
            root: workdir,
            branch,
            head: head_oid,
            upstream,
            ahead,
            behind,
            clean: files.is_empty(),
        },
        files,
    })
}

#[tauri::command]
pub fn git_log(path: String, limit: Option<usize>) -> Result<Vec<GitCommit>, String> {
    let repo = find_repo(&path)?;
    let mut walk = repo.revwalk().map_err(|e| e.message().to_string())?;
    walk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL).ok();
    walk.push_head().map_err(|e| e.message().to_string())?;

    let limit = limit.unwrap_or(200);
    let mut commits = Vec::new();
    for (i, oid) in walk.flatten().enumerate() {
        if i >= limit {
            break;
        }
        let commit = repo.find_commit(oid).map_err(|e| e.message().to_string())?;
        let id = oid.to_string();
        let short_id = id.chars().take(7).collect::<String>();
        let summary = commit.summary().unwrap_or("").to_string();
        let author = commit.author();
        let parents: Vec<String> = commit.parent_ids().map(|p| p.to_string()).collect();
        commits.push(GitCommit {
            id,
            short_id,
            summary,
            author: author.name().unwrap_or("").to_string(),
            email: author.email().unwrap_or("").to_string(),
            time: commit.time().seconds(),
            parents,
        });
    }
    Ok(commits)
}

#[tauri::command]
pub fn git_diff(path: String, file: String, staged: bool) -> Result<String, String> {
    let repo = find_repo(&path)?;
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(&file);

    let diff = if staged {
        let head_tree = repo
            .head()
            .ok()
            .and_then(|h| h.peel(ObjectType::Tree).ok())
            .and_then(|o| o.into_tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
            .map_err(|e| e.message().to_string())?
    } else {
        repo.diff_index_to_workdir(None, Some(&mut opts))
            .map_err(|e| e.message().to_string())?
    };

    let mut out = String::new();
    diff.print(git2::DiffFormat::Patch, |_, _, line| {
        let prefix = match line.origin() {
            '+' | '-' | ' ' => format!("{}", line.origin()),
            _ => String::new(),
        };
        out.push_str(&prefix);
        out.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
        true
    })
    .map_err(|e| e.message().to_string())?;
    Ok(out)
}

#[tauri::command]
pub fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = find_repo(&path)?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Bare repository".to_string())?
        .to_path_buf();

    for f in &files {
        let abs = workdir.join(f);
        if !abs.exists() {
            // file deleted in workdir: remove from index
            index.remove_path(Path::new(f)).ok();
        } else {
            index
                .add_all([f].iter(), IndexAddOption::DEFAULT, None)
                .map_err(|e| e.message().to_string())?;
        }
    }
    index.write().map_err(|e| e.message().to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = find_repo(&path)?;
    let head = repo.head().ok().and_then(|h| h.peel(ObjectType::Commit).ok());
    let paths: Vec<&Path> = files.iter().map(|f| Path::new(f.as_str())).collect();

    if let Some(commit_obj) = head {
        repo.reset_default(Some(&commit_obj), paths.iter().map(|p| p.as_os_str()))
            .map_err(|e| e.message().to_string())?;
    } else {
        // No HEAD yet (initial commit): remove from index
        let mut index = repo.index().map_err(|e| e.message().to_string())?;
        for f in &files {
            index.remove_path(Path::new(f)).ok();
        }
        index.write().map_err(|e| e.message().to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<String, String> {
    let repo = find_repo(&path)?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.message().to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.message().to_string())?;

    let sig = repo
        .signature()
        .or_else(|_| Signature::now("TotalCMD-MP", "noreply@localhost"))
        .map_err(|e| e.message().to_string())?;

    let parent_commit = repo
        .head()
        .ok()
        .and_then(|h| h.peel(ObjectType::Commit).ok())
        .and_then(|o| o.into_commit().ok());

    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();
    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| e.message().to_string())?;
    Ok(oid.to_string())
}

#[tauri::command]
pub fn git_branches(path: String) -> Result<Vec<GitBranch>, String> {
    let repo = find_repo(&path)?;
    let head_name = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    let mut out = Vec::new();
    for entry in repo.branches(None).map_err(|e| e.message().to_string())? {
        let (branch, btype) = entry.map_err(|e| e.message().to_string())?;
        let name = branch.name().ok().flatten().unwrap_or("").to_string();
        let is_remote = matches!(btype, BranchType::Remote);
        let is_head = !is_remote && Some(&name) == head_name.as_ref();
        let upstream = if !is_remote {
            branch
                .upstream()
                .ok()
                .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()))
        } else {
            None
        };
        out.push(GitBranch {
            name,
            is_remote,
            is_head,
            upstream,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn git_checkout(path: String, branch: String) -> Result<(), String> {
    let repo = find_repo(&path)?;
    let (object, reference) = repo
        .revparse_ext(&branch)
        .map_err(|e| e.message().to_string())?;
    repo.checkout_tree(&object, None)
        .map_err(|e| e.message().to_string())?;
    match reference {
        Some(gref) => repo.set_head(gref.name().unwrap_or("HEAD")),
        None => repo.set_head_detached(object.id()),
    }
    .map_err(|e| e.message().to_string())?;
    Ok(())
}

fn build_callbacks() -> RemoteCallbacks<'static> {
    let mut cb = RemoteCallbacks::new();
    cb.credentials(|url, username_from_url, allowed_types| {
        if allowed_types.contains(CredentialType::SSH_KEY) {
            let user = username_from_url.unwrap_or("git");
            if let Ok(c) = Cred::ssh_key_from_agent(user) {
                return Ok(c);
            }
            // Try default keys
            if let Some(home) = dirs::home_dir() {
                for key in &["id_ed25519", "id_rsa"] {
                    let priv_key: PathBuf = home.join(".ssh").join(key);
                    if priv_key.exists() {
                        if let Ok(c) =
                            Cred::ssh_key(user, None, &priv_key, None)
                        {
                            return Ok(c);
                        }
                    }
                }
            }
        }
        if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if let Ok(config) = git2::Config::open_default() {
                if let Ok(c) = Cred::credential_helper(&config, url, username_from_url) {
                    return Ok(c);
                }
            }
        }
        if allowed_types.contains(CredentialType::DEFAULT) {
            return Cred::default();
        }
        Err(git2::Error::from_str("no suitable credentials available"))
    });
    cb
}

#[tauri::command]
pub fn git_fetch(path: String, remote: Option<String>) -> Result<(), String> {
    let repo = find_repo(&path)?;
    let remote_name = remote.unwrap_or_else(|| "origin".into());
    let mut r = repo
        .find_remote(&remote_name)
        .map_err(|e| e.message().to_string())?;
    let mut fopts = FetchOptions::new();
    fopts.remote_callbacks(build_callbacks());
    let refspecs: Vec<String> = r
        .fetch_refspecs()
        .map_err(|e| e.message().to_string())?
        .iter()
        .filter_map(|s| s.map(String::from))
        .collect();
    r.fetch(&refspecs, Some(&mut fopts), None)
        .map_err(|e| e.message().to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_pull(path: String, remote: Option<String>) -> Result<String, String> {
    git_fetch(path.clone(), remote.clone())?;
    let repo = find_repo(&path)?;

    let head = repo.head().map_err(|e| e.message().to_string())?;
    let branch_name = head
        .shorthand()
        .ok_or_else(|| "No current branch".to_string())?
        .to_string();
    let local = repo
        .find_branch(&branch_name, BranchType::Local)
        .map_err(|e| e.message().to_string())?;
    let up = local
        .upstream()
        .map_err(|_| "No upstream tracking branch".to_string())?;
    let up_oid = up
        .get()
        .target()
        .ok_or_else(|| "Upstream has no target".to_string())?;
    let up_commit = repo
        .find_annotated_commit(up_oid)
        .map_err(|e| e.message().to_string())?;

    let (analysis, _) = repo
        .merge_analysis(&[&up_commit])
        .map_err(|e| e.message().to_string())?;

    if analysis.is_up_to_date() {
        return Ok("up-to-date".into());
    }
    if analysis.is_fast_forward() {
        let refname = format!("refs/heads/{}", branch_name);
        let mut reference = repo
            .find_reference(&refname)
            .map_err(|e| e.message().to_string())?;
        reference
            .set_target(up_oid, "fast-forward")
            .map_err(|e| e.message().to_string())?;
        repo.set_head(&refname)
            .map_err(|e| e.message().to_string())?;
        repo.checkout_head(Some(
            git2::build::CheckoutBuilder::default().force(),
        ))
        .map_err(|e| e.message().to_string())?;
        return Ok("fast-forward".into());
    }
    Err("Pull requires merge or rebase (not yet supported)".into())
}

#[tauri::command]
pub fn git_push(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<(), String> {
    let repo = find_repo(&path)?;
    let remote_name = remote.unwrap_or_else(|| "origin".into());
    let mut r = repo
        .find_remote(&remote_name)
        .map_err(|e| e.message().to_string())?;

    let branch_name = if let Some(b) = branch {
        b
    } else {
        repo.head()
            .map_err(|e| e.message().to_string())?
            .shorthand()
            .ok_or_else(|| "No current branch".to_string())?
            .to_string()
    };

    let refspec = format!("refs/heads/{0}:refs/heads/{0}", branch_name);
    let mut popts = PushOptions::new();
    popts.remote_callbacks(build_callbacks());
    r.push(&[refspec.as_str()], Some(&mut popts))
        .map_err(|e| e.message().to_string())?;
    Ok(())
}
