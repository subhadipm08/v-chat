import { Link } from 'react-router-dom';

export default function MeetixBrand({ to = '/', className = '' }) {
  return (
    <Link to={to} className={`meetix-brand-link ${className}`.trim()} aria-label="Meetix home" title="Meetix">
      <img src="/meetix.png" alt="Meetix logo" className="meetix-brand-logo" />
      <span className="meetix-brand-name">Meetix</span>
    </Link>
  );
}
