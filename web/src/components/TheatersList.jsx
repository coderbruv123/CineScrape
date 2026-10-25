export default function TheatersList({ theaters }) {
  if (!theaters || theaters.length === 0) {
    return <p className="empty">No theaters found.</p>
  }
  return (
    <div className="theater-list">
      {theaters.map((t) => (
        <div key={t.id} className="theater-row">
          <span className="theater-row__name">{t.name}</span>
          <span className="theater-row__meta">{t.city || '—'}</span>
        </div>
      ))}
    </div>
  )
}
