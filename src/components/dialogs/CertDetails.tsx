import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CertInfo } from '../../services/connections';

export function CertDetails({ info }: { info: CertInfo }) {
  const fp = info.fingerprintSha256;
  const issues: string[] = [];
  if (info.expired) issues.push('scaduto o non ancora valido');
  if (info.selfSigned) issues.push('self-signed');
  if (!info.hostnameMatches) issues.push(`hostname non corrisponde a ${info.hostQueried}`);

  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-2 text-[11px] font-mono space-y-1 text-[var(--color-text-primary)]">
      <div className="flex items-center gap-2 mb-1">
        {info.expired || !info.hostnameMatches ? (
          <ShieldAlert size={12} className="text-red-400" />
        ) : info.selfSigned ? (
          <ShieldAlert size={12} className="text-yellow-400" />
        ) : (
          <ShieldCheck size={12} className="text-green-400" />
        )}
        <span className="font-sans font-semibold text-xs">Certificato del server</span>
      </div>
      <Row label="Subject" value={info.subject} />
      <Row label="Issuer" value={info.issuer} />
      <Row label="Valido dal" value={info.notBefore} />
      <Row label="Valido fino al" value={info.notAfter} />
      <Row label="Serial" value={info.serial} />
      <Row label="SHA-256" value={fp} copy={fp} />
      {info.sans.length > 0 && <Row label="SAN" value={info.sans.join(', ')} />}
      {issues.length > 0 && (
        <div className="text-red-300 text-[11px] font-sans pt-1">⚠ {issues.join(' · ')}</div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  copy,
}: {
  label: string;
  value: string;
  copy?: string;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-[var(--color-text-muted)] w-20 flex-shrink-0 font-sans">
        {label}
      </span>
      <span className="flex-1 break-all">{value || '—'}</span>
      {copy && (
        <button
          onClick={() => navigator.clipboard?.writeText(copy)}
          className="text-[10px] text-[var(--color-accent)] hover:underline font-sans flex-shrink-0"
          title="Copia"
        >
          copia
        </button>
      )}
    </div>
  );
}

export const CERT_ERROR_REGEX =
  /certificate|verify failed|self.?signed|unable to get|FTPS upgrade/i;
