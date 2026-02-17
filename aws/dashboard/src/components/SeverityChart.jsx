import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6']

export default function SeverityChart({ summary }) {
  const data = [
    { name: 'Critical', value: summary.critical || 0 },
    { name: 'Serious', value: summary.serious || 0 },
    { name: 'Moderate', value: summary.moderate || 0 },
    { name: 'Minor', value: summary.minor || 0 },
  ].filter(d => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">📈 Distribution</span>
        </div>
        <div style={{ textAlign: 'center', padding: '2rem', color: '#22c55e', fontSize: '1.1rem' }}>
          ✅ No violations found!
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">📈 Distribution</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[['Critical', 'Serious', 'Moderate', 'Minor'].indexOf(entry.name)]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#f1f5f9',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.75rem' }}
            iconSize={10}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
