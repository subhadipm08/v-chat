import { Activity, Users, Video } from 'lucide-react';
import { useStats } from '../../context/stats-context';

export default function LiveStats() {
  const { online, waiting, active } = useStats();

  const statItems = [
    {
      label: 'Online Users',
      value: online,
      icon: <Users size={20} />,
      color: '#3b82f6', // blue
      description: 'People currently connected'
    },
    {
      label: 'Waiting for Match',
      value: waiting,
      icon: <Activity size={20} />,
      color: '#f59e0b', // amber
      description: 'Users in random queue'
    },
    {
      label: 'Active Calls',
      value: active,
      icon: <Video size={20} />,
      color: '#10b981', // emerald
      description: 'Ongoing video sessions'
    }
  ];

  return (
    <div className="stats-grid" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
      gap: '0.9rem',
      margin: '1rem 0 1.5rem',
      width: '100%'
    }}>
      {statItems.map((item, index) => (
        <div 
          key={index} 
          className="glass-panel" 
          style={{ 
            padding: 'clamp(1rem, 2vw, 1.25rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              backgroundColor: `${item.color}20`, 
              color: item.color,
              padding: '0.5rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {item.icon}
            </div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
              {item.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: '700', color: 'var(--text-primary)' }}>
              {item.value}
            </span>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            {item.description}
          </p>

          <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            width: '100%', 
            height: '2px', 
            backgroundColor: item.color,
            opacity: 0.3
          }} />
        </div>
      ))}
    </div>
  );
}
