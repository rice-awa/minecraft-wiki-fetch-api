import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from './Toast';
import { syntaxHighlight } from '../utils/jsonHighlight';

interface BatchData {
  results: Array<{
    title: string;
    success: boolean;
    content?: string;
    error?: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export function BatchCard() {
  const { loading, execute } = useApi();
  const { showToast } = useToast();
  const [pages, setPages] = useState('钻石\n铁锭\n金锭');
  const [format, setFormat] = useState('markdown');
  const [concurrency, setConcurrency] = useState(3);
  const [result, setResult] = useState<BatchData | null>(null);

  const testBatchPages = async () => {
    const pageList = pages.split('\n').map(p => p.trim()).filter(p => p);

    if (pageList.length === 0) {
      showToast('列表不能为空', 'error');
      return;
    }

    const response = await execute<BatchData>(`${window.location.origin}/api/pages`, {
      method: 'POST',
      body: JSON.stringify({ pages: pageList, format, concurrency }),
    });

    if (response.success && response.data) {
      setResult(response.data);
      showToast(`请求成功 (${response.status})`);
    } else {
      showToast('请求失败', 'error');
    }
  };

  const loadPreset = (type: 'tools' | 'blocks') => {
    const presets = {
      tools: ['钻石剑', '钻石镐', '钻石斧', '钻石锹'],
      blocks: ['钻石块', '铁块', '金块', '红石块'],
    };
    if (presets[type]) {
      setPages(presets[type].join('\n'));
      showToast(`已加载预设: ${type}`);
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
          <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
          <h2 className="font-semibold text-slate-800">批量操作</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">POST /api/pages</span>
      </div>
      <div className="p-6">
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">页面列表 (每行一个)</label>
            <div className="space-x-1">
              <button
                onClick={() => loadPreset('tools')}
                className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
              >
                工具
              </button>
              <button
                onClick={() => loadPreset('blocks')}
                className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
              >
                方块
              </button>
            </div>
          </div>
          <textarea
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none custom-scrollbar"
            placeholder="钻石\n铁锭"
          />
        </div>

        <div className="flex gap-4 mb-5">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">格式</label>
            <div className="relative">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 appearance-none"
              >
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
                <option value="wikitext">Wikitext</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-3 text-slate-400 pointer-events-none text-[10px]"></i>
            </div>
          </div>
          <div className="w-24 space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">并发数</label>
            <input
              type="number"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              max={5}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
        </div>

        <button
          onClick={testBatchPages}
          disabled={loading}
          className="w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg shadow-sm shadow-orange-200 transition-all active:scale-95 disabled:opacity-50"
        >
          开始批量获取
        </button>

        {result && (
          <div className="group relative mt-6">
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