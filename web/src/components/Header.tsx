export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-white p-2 rounded-lg shadow-sm">
              <i className="fa-solid fa-cube text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Minecraft Wiki API</h1>
              <p className="text-xs text-slate-500 font-medium">开发者测试控制台</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              System Ready
            </span>
            <a 
              href="https://github.com/rice-awa/minecraft-wiki-fetch-api" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-800 transition-colors"
            >
              <i className="fa-brands fa-github text-xl"></i>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}