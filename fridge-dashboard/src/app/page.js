'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler
} from 'chart.js';

// רישום הרכיבים של Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler
);

// --- קומפוננטת הגרף הפנימית ---
function FridgeGraph({ fridgeId, hasAnomaly }) {
  const [logData, setLogData] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/get-fridge-logs?fridge_id=${fridgeId}`);
        if (response.ok) {
          const data = await response.json();
          setLogData(data);
        }
      } catch (err) {
        console.error("Failed loading graph logs", err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 30000); // רענון הגרף כל 30 שניות
    return () => clearInterval(interval);
  }, [fridgeId]);

  if (logData.length === 0) {
    return <div className="text-center text-xs text-gray-600 py-4">אין מספיק נתוני היסטוריה לגרף...</div>;
  }

  // הכנת הנתונים למבנה של Chart.js
  const chartData = {
    labels: logData.map(log => {
      const date = new Date(log.created_at);
      return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        fill: true,
        label: 'טמפרטורה',
        data: logData.map(log => log.temperature),
        borderColor: hasAnomaly ? '#f87171' : '#34d399', // אדום בחריגה, ירוק בתקין
        backgroundColor: hasAnomaly ? 'rgba(248, 113, 113, 0.1)' : 'rgba(52, 211, 153, 0.05)',
        tension: 0.3, // עיגול פינות של הקו שיקבל מראה חלק
        pointRadius: 0, // העלמת הנקודות בשביל מראה נקי, הן יופיעו רק ב-Hover
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } }, // העלמת מקרא הכתב העליון
    scales: {
      x: { display: false }, // העלמת ציר ה-X למראה מינימליסטי
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#6b7280', font: { size: 9 } }
      }
    }
  };

  return (
    <div className="h-24 w-full mt-4 bg-gray-950/40 rounded-xl p-2 border border-gray-900/40">
      <Line data={chartData} options={options} />
    </div>
  );
}

// --- הקומפוננטה המרכזית של ה-Dashboard ---
export default function Dashboard() {
  const [fridges, setFridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFridges = async () => {
    try {
      const response = await fetch('/api/get-fridges');
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      setFridges(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFridges();
    const interval = setInterval(fetchFridges, 5000); 
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-xl font-semibold animate-pulse">טוען נתוני מקררים...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-red-500">
        <div className="text-xl font-bold">שגיאה בטעינת הנתונים: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans select-none" dir="rtl">
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            ❄️ מערכת בקרת מקררים בזמן אמת
          </h1>
          <p className="text-gray-400 mt-1 text-sm">ניטור, מעקב והתרעות לטמפרטורות IoT בשטח</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-2 text-xs text-gray-400 bg-gray-900 px-3 py-2 rounded-lg border border-gray-800">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
          <span>מתרענן אוטומטית כל 5 שניות</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {fridges.map((fridge) => {
          const currentUnix = Math.floor(Date.now() / 1000);
          const lastSeenUnix = Number(fridge.last_seen || 0);
          const minutesSinceLastSeen = lastSeenUnix ? (currentUnix - lastSeenUnix) / 60 : Infinity;
          const isDisconnected = minutesSinceLastSeen > ((fridge.update_interval_minutes || 10) + 3);
          
          const isTempHigh = !isDisconnected && fridge.current_temp > fridge.max_temp;
          const isTempLow = !isDisconnected && fridge.min_temp_limit !== null && fridge.current_temp < fridge.min_temp_limit;
          const hasAnomaly = isTempHigh || isTempLow;

          let cardStyle = "bg-gray-900 border-gray-800 hover:border-gray-700";
          let statusText = "🟢 תקין";
          let statusColor = "text-green-400";

          if (isDisconnected) {
            cardStyle = "bg-gray-900/40 border-gray-950 opacity-60 grayscale";
            statusText = "🔴 מנותק";
            statusColor = "text-red-500 font-bold";
          } else if (hasAnomaly) {
            cardStyle = "bg-red-950/40 border-red-500/50 animate-pulse shadow-lg shadow-red-900/20";
            statusText = isTempHigh ? "🚨 חריגת חום קריטית!" : "❄️ סכנת קיפאון!";
            statusColor = "text-red-400 font-black";
          }

          return (
            <div key={fridge.fridge_id} className={`border rounded-2xl p-6 transition-all duration-300 ${cardStyle}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">{fridge.fridge_name || fridge.fridge_id}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">קוד מקרר: {fridge.fridge_id}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full bg-gray-950/60 font-medium ${statusColor}`}>
                  {statusText}
                </span>
              </div>

              <div className="my-6 flex items-baseline justify-center bg-gray-950/40 py-4 rounded-xl border border-gray-900/60">
                <span className={`text-5xl font-black tracking-tight ${isDisconnected ? 'text-gray-600' : hasAnomaly ? 'text-red-400' : 'text-green-400'}`}>
                  {isDisconnected ? '--.-' : fridge.current_temp?.toFixed(1)}
                </span>
                <span className="text-lg font-medium text-gray-500 mr-1">°C</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-950/20 p-3 rounded-lg border border-gray-900/30">
                <div>
                  <span className="text-gray-500 block">מקסימום מותר:</span>
                  <span className="font-semibold text-gray-300">{fridge.max_temp?.toFixed(1)}°C</span>
                </div>
                <div>
                  <span className="text-gray-500 block">מינימום מותר:</span>
                  <span className="font-semibold text-gray-300">
                    {fridge.min_temp_limit !== null ? `${fridge.min_temp_limit?.toFixed(1)}°C` : 'ללא הגבלה'}
                  </span>
                </div>
              </div>

              {/* --- הגרף הוויזואלי החדש --- */}
              {!isDisconnected && (
                <div className="mt-4">
                  <span className="text-[10px] text-gray-500 block mb-1">מגמה ב-24 שעות האחרונות:</span>
                  <FridgeGraph fridgeId={fridge.fridge_id} hasAnomaly={hasAnomaly} />
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-800/60 flex justify-between text-xs text-gray-400">
                <span>נראה לאחרונה:</span>
                <span className={`font-mono ${isDisconnected ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                  {isDisconnected ? `לפני ${minutesSinceLastSeen.toFixed(0)} דקות` : minutesSinceLastSeen < 1 ? 'הרגע' : `לפני ${minutesSinceLastSeen.toFixed(0)} דקות`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}