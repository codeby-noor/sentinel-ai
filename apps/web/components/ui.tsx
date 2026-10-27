export function StatusBadge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{value}</span>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card" role="status">
      <strong>{title}</strong>
      {hint && <p style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="alert error" role="alert">{message}</div>;
}
