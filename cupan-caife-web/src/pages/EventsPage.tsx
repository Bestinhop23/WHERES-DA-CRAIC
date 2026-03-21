import { useEffect, useState } from 'react';
import { Colors } from '../constants/Colors';

interface EventItem {
  name: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  county: string;
  url: string;
  description: string;
  host: string;
  tags: string[];
}

interface EventsData {
  events: EventItem[];
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/events.json')
      .then((r) => r.json())
      .then((data: EventsData) => setEvents(data.events || []))
      .catch((err) => console.error('Failed to load events', err));
  }, []);

  const filtered = events.filter((ev) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      ev.name?.toLowerCase().includes(q) ||
      ev.county?.toLowerCase().includes(q) ||
      ev.venue?.toLowerCase().includes(q) ||
      ev.host?.toLowerCase().includes(q)
    );
  });

  // Group by date
  const grouped: Record<string, EventItem[]> = {};
  filtered.forEach((ev) => {
    const key = ev.date || 'TBD';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: Colors.background }}>
      <div className="irish-bar" />

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '24px 20px 0' }}>
        <div style={{ fontSize: 42, marginBottom: 6 }}>🎉</div>
        <h1 style={{ color: Colors.text, fontSize: 24, fontWeight: 800, margin: 0 }}>Events</h1>
        <p style={{ color: Colors.accent, fontSize: 13, fontStyle: 'italic', marginTop: 4 }}>
          {events.length} events across Ireland
        </p>
      </div>

      {/* Search */}
      <div style={{ padding: '16px 20px 0' }}>
        <input
          type="text"
          placeholder="Search events, venues, counties..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: Colors.surface, border: `1px solid ${Colors.border}`,
            borderRadius: 12, padding: '12px 16px', color: Colors.text,
            fontSize: 14, outline: 'none',
          }}
        />
      </div>

      {/* Events list */}
      <div style={{ padding: '12px 20px' }}>
        {Object.entries(grouped).map(([date, dateEvents]) => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            }}>
              <div style={{
                color: isToday(date) ? Colors.success : Colors.accent,
                fontSize: 14, fontWeight: 800,
              }}>
                {formatDate(date)}
              </div>
              {isToday(date) && (
                <span style={{
                  backgroundColor: Colors.success + '20', color: Colors.success,
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                }}>TODAY</span>
              )}
            </div>

            {dateEvents.map((ev, i) => (
              <a
                key={`${ev.name}-${i}`}
                href={ev.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center',
                  backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
                  marginBottom: 8, border: `1px solid ${Colors.border}`,
                  textDecoration: 'none', gap: 12,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  backgroundColor: Colors.primary + '30',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>📅</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: Colors.text, fontSize: 14, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{ev.name}</div>
                  <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 3 }}>
                    {ev.time?.replace(' UTC', '')} · {ev.venue || ev.county}
                  </div>
                  {ev.host && (
                    <div style={{
                      color: Colors.textMuted, fontSize: 11, marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>by {ev.host}</div>
                  )}
                </div>
                <span style={{ color: Colors.accent, fontSize: 16, fontWeight: 700, flexShrink: 0 }}>→</span>
              </a>
            ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🔍</span>
            <div style={{ color: Colors.textSecondary, fontSize: 14 }}>No events found</div>
          </div>
        )}
      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}
