export default function ActionPanel({ title, description, children, centered = false }) {
  return (
    <section
      className="glass-panel action-panel"
      style={centered ? { justifyContent: 'center', alignItems: 'center', textAlign: 'center' } : undefined}
    >
      <h3>{title}</h3>
      {description ? <p className="panel-description">{description}</p> : null}
      {children}
    </section>
  );
}
