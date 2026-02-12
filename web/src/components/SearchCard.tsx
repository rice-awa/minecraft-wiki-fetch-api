import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from './Toast';
import { syntaxHighlight } from '../utils/jsonHighlight';

interface SearchData {
  results: Array<{ title: string; url: string }>;
  total: number;
  [key: string]: unknown;
}

export function SearchCard() {
  const { loading, execute } = useApi();
  const { showToast } = useToast();
  const [keyword, setKeyword] = useState('钻石');
  const [limit, setLimit] = useState(5);
  const [result, setResult] = useState<SearchData | null>(null);

  const testSearch = async (pretty = false) => {
    if (!keyword.trim()) {
      showToast('请输入关键词', 'error');
      return;
    }

    const params = new URLSearchParams({ q: keyword, limit: String(limit) });
    if (pretty) params.append('pretty', 'true');

    const response = await execute<SearchData>(`${window.location.origin}/api/search?${params}`);
    if (response.success && response.data) {
      setResult(response.data);
      showToast(`请求成功 (${response.status})`);
    } else {
      showToast('请求失败', 'error');
    }
  };

  const quickSearch = async (kw: string) => {
    setKeyword(kw);
    const params = new URLSearchParams({ q: kw, limit: String(limit), pretty: 'true' });
    const response = await execute<SearchData>(`${window.location.origin}/api/search?${params}`);
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
          <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
          <h2 className="font-semibold text-slate-800">全站搜索</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">/api/search</span>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">关键词</label>
            <div className="relative">
              <i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                placeholder="例如: 铁锭"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">数量限制</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              min={1}
              max={50}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => testSearch(true)}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
          >
            <i className="fa-solid fa-play mr-1.5"></i> 执行搜索
          </button>
          <div className="h-6 w-px bg-slate-200 mx-1"></div>
          <span className="text-xs text-slate-500 font-medium">热门:</span>
          <button
            onClick={() => quickSearch('红石')}
            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:border-red-200 rounded-md text-xs font-medium transition-colors"
          >
            红石
          </button>
          <button
            onClick={() => quickSearch('末影龙')}
            className="px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100 hover:border-purple-200 rounded-md text-xs font-medium transition-colors"
          >
            末影龙
          </button>
        </div>

        {result && (
          <div className="group relative">
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={copyResult}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2 py-1 rounded border border-slate-600 backdrop-blur"
              >
                <i className="fa-regular fa-copy mr-1"></i>Copy
              </button>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto custom-scrollbar shadow-inner max-h-[400px]">
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
