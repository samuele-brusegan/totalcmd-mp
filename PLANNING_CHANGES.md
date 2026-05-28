Priorità alta (cose che ti useresti tutti i giorni)

1. Cestino + Undo invece di delete distruttivo F8 manda nel ~/.local/share/Trash (XDG spec) invece di rm -rf. Su Linux la crate trash lo fa già. Ctrl+Z annulla
l'ultima operazione (move/rename/delete) entro un timeout. Toglie ansia.

2. Conflict resolution dialog Quando F5/F6 trova un file con lo stesso nome a
destinazione: prompt con Skip / Overwrite / Rename / Skip-if-newer / Apply to 
all. Adesso non c'è — i copy_items Rust scrivono ciecamente. Per upload/download remoto è ancora peggio.

3. Resume / queue persistente dei trasferimenti I trasferimenti FTP grossi si
interrompono spesso. Con REST (FTP) o SFTP-resume puoi riprendere da dove si era interrotto. La coda viene serializzata su disco così sopravvive al riavvio.
Combinato col multi-thread che hai già, è il salto definitivo verso "vero client FTP".

4. Terminale integrato Apri una shell (bash/zsh/pwsh) nel cwd del pannello attivocon un shortcut (es. Ctrl+`). Niente di troppo elaborato: un widget xterm.js
sotto al pannello o in un drawer. Per chi vive in TC questo manca davvero.

5. Bookmarks / Favorites + cronologia Lista di cartelle frequenti con shortcut
numerati (Ctrl+1…0) come TC. Alt+← / Alt+→ per la cronologia (in parte già hai
con navigateBack/Forward nel store, ma non è esposta). Più una palette tipo
Ctrl+K che fuzzy-cerca tra bookmark + cronologia.

Priorità media (feature da power user)

6. Archive support trasparente Entrare in uno .zip/.tar.gz come se fosse una
directory (virtual fs). Estrarre, creare archivi. Sopporto via crate Rust zip, tar, flate2, sevenz-rust. È la feature flagship di TC.

7. Tree view nella sidebar Pannello opzionale a sinistra di ogni panel con
l'albero delle directory. Molto utile su filesystem profondi. Toggle con
shortcut.

8. File preview pane Quando ti muovi col cursore su immagini/text/md, mostra
preview live in un drawer laterale senza dover premere F3. È quasi gratis (riusi viewer + markdown render esistenti) e cambia l'esperienza.

9. Disk usage analyzer "Du-style": calcola dimensioni ricorsivamente e mostra
cartelle ordinate per peso (con barre proporzionali). C'è la tradizione ncdu / WizTree / WinDirStat. È un must per "perché ho il disco pieno".

10. Tag / etichette per file Su filesystem che li supportano (xattr su Linux/
macOS, ADS su Windows): tag colorati, filtri per tag. Persistenza in .tcmp_tags.json come fallback.

Priorità bassa (nice to have)

11. Confronto file binario / diff testuale Selezioni 2 file e Shift+F3 apre una
vista diff (riusa il diff git-style che hai già nel Git panel) o un hex-diff
binary.

12. Sync rsync-style tra pannelli "Mirror left → right" che fa diff + copia solo i cambiamenti. C'è già dir-compare ma è informativo, non operativo.

13. WebDAV / S3 / Google Drive / Dropbox Aggiungere altri "protocolli" oltre FTP/SFTP. WebDAV è il più richiesto (es. NextCloud). S3 e simili tramite rclone
embedded oppure SDK nativi.

14. Custom shortcut editor Settings → keyboard, l'utente rimappa qualunque
shortcut.

15. i18n Tutto ora è inglese mischiato a italiano. Estrai in i18n.json con chiavitradotte; libreria react-i18next o un wrapper minimale.

16. Plugin API Esponi un'API JS che permetta agli utenti di scrivere script in
~/.config/totalcmd-mp/plugins/*.js per: aggiungere colonne, registrare comandi,
hookare eventi. Dovrebbe usare la sandbox webview.

17. Right-click context menu Adesso c'è solo Insert/Space e shortcut. Un menu
contestuale standard (open with, copy path, properties, …) per chi usa anche il
mouse.

18. Properties / file info dialog Alt+Enter su un file → dialog con tutti i
metadati (size, mtime, permissions, owner, hash sha256/md5 on-demand, xattr).

19. Multi-rename con regex preview migliorato C'è già il MultiRenameDialog, ma
una preview live dei nomi risultanti + supporto regex named capture + counter
incrementale ($1, %d) lo eleverebbe a quello di TC.

20. Trasferimenti FTP con progress byte-level Adesso il progress del singolo filesalta 0 → 100% (single-shot retr/stor). Streamare a chunk con retr_as_stream
(suppaftp) e ssh2::File Read/Write per emettere progress fine-grained. Utile su
file grossi.
