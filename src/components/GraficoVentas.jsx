// GraficoVentas.jsx
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Registrar Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function GraficoVentas({ ventasPorDia, formatearMoneda }) {
  const chartData = {
    labels: ventasPorDia.map(v => 
      new Date(v.fecha).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })
    ),
    datasets: [
      {
        label: 'Total Ventas',
        data: ventasPorDia.map(v => v.total),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#4f46e5',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Ventas: ${formatearMoneda(context.raw)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: true,
          drawBorder: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          drawBorder: false
        },
        ticks: {
          callback: function(value) {
            if (value >= 1000) {
              return '₡' + (value / 1000).toFixed(0) + 'k';
            }
            return '₡' + value;
          }
        }
      }
    }
  };

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
}