import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from './Toast';
import { syntaxHighlight } from '../utils/jsonHighlight';

interface HealthData {
  status: string;
  [key: string]: unknown;
}

export function HealthCard() {
  const { loading, execute } = useApi();
  const { showToast } = useToast();
  const [result, setResult] = useState<HealthData | null>(null);

  const testHealth = async (endpoint: string) => {
    const response = await execute<HealthData>(`${window.location.origin}${endpoint}`);
    if (response.success && response.data) {
      setResult(response.data);
      showToast(`请求成功 (${response.status})`);
    } else {
      showToast('请求失败', 'error');
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2))
        .then(() => showToast('内容已复制到剪贴板'))
        .catch(() => showToast('复制失败', 'error'));
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
          <h2 className="font-semibold text-slate-800">系统诊断</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">/health/*</span>
      </div>
      <div className="p-6">
        <div className="flex flex-wrap gap-3 mb-6">
          <button 
            onClick={() => testHealth('/health')}
            disabled={loading}
            className="flex-1 min-w-[120px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-emerald-200 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50"
          >
            <i className="fa-solid fa-check-circle"></i> 基础检查
          </button>
          <button 
            onClick={() => testHealth('/health/detailed')}
            disabled={loading}
            className="flex-1 min-w-[120px] px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-emerald-300 hover:text-emerald-700 text-sm font-medium rounded-lg transition-all active:scale-95 disabled:opacity-50"
          >
            详细信息
          </button>
          <button 
            onClick={() => testHealth('/health/live')}
            disabled={loading}
            className="flex-1 min-w-[120px] px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-emerald-300 hover:text-emerald-700 text-sm font-medium rounded-lg transition-all active:scale-95 disabled:opacity-50"
          >
            存活状态
          </button>
        </div>
        
        {result && (
          <div className="group relative">
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={copyResult}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2 py-1 rounded border border-slate-600"
              >
                <i className="fa-regular fa-copy mr-1"></i>Copy
              </button>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto custom-scrollbar shadow-inner max-h-64">
              <pre 
                className="text-slate-300"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(result) }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
