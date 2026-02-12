import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from './Toast';
import { syntaxHighlight } from '../utils/jsonHighlight';

interface PageData {
  title: string;
  content?: string;
  markdown?: string;
  html?: string;
  wikitext?: string;
  [key: string]: unknown;
}

export function PageCard() {
  const { loading, execute } = useApi();
  const { showToast } = useToast();
  const [pageName, setPageName] = useState('草方块');
  const [format, setFormat] = useState('both');
  const [result, setResult] = useState<PageData | null>(null);

  const testPage = async (pretty = false) => {
    if (!pageName.trim()) {
      showToast('请输入页面名称', 'error');
      return;
    }

    const params = new URLSearchParams({ format });
    if (pretty) params.append('pretty', 'true');

    const response = await execute<PageData>(
      `${window.location.origin}/api/page/${encodeURIComponent(pageName)}?${params}`
    );
    if (response.success && response.data) {
      setResult(response.data);
      showToast(`请求成功 (${response.status})`);
    } else {
      showToast('请求失败', 'error');
    }
  };

  const testPageExists = async () => {
    if (!pageName.trim()) {
      showToast('请输入页面名称', 'error');
      return;
    }
    const response = await execute<PageData>(
      `${window.location.origin}/api/page/${encodeURIComponent(pageName)}/exists`
    );
    if (response.success && response.data) {
      setResult(response.data);
      showToast(`请求成功 (${response.status})`);
    } else {
      showToast('请求失败', 'error');
    }
  };

  const quickPage = async (name: string) => {
    setPageName(name);
    const response = await execute<PageData>(
      `${window.location.origin}/api/page/${encodeURIComponent(name)}?pretty=true`
    );
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
          <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>
          <h2 className="font-semibold text-slate-800">页面获取</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">/api/page/{'{title}'}</span>
      </div>
      <div className="p-6">
        <div className="space-y-4 mb-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">页面标题</label>
            <input
              type="text"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">格式</label>
            <div className="relative">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer"
              >
                <option value="both">Both (HTML + Markdown)</option>
                <option value="html">HTML Only</option>
                <option value="markdown">Markdown Only</option>
                <option value="wikitext">Wikitext Only</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-4 top-3.5 text-slate-400 pointer-events-none text-xs"></i>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => testPage(true)}
            disabled={loading}
            className="col-span-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-purple-200 transition-all active:scale-95 disabled:opacity-50"
          >
            获取页面详情
          </button>
          <button
            onClick={testPageExists}
            disabled={loading}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:border-purple-300 hover:text-purple-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            检查存在性
          </button>
          <button
            onClick={() => quickPage('工作台')}
            disabled={loading}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:border-purple-300 hover:text-purple-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            示例: 工作台
          </button>
        </div>

        {result && (
          <div className="group relative">
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={copyResult}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2 py-1 rounded border border-slate-600 backdrop-blur"
              >
                <i className="fa-regular fa-copy mr-1"></i>
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
