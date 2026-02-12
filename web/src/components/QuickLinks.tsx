const links = [
  {
    href: '/health',
    icon: 'fa-heart-pulse',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    iconBgHover: 'group-hover:bg-blue-100',
    title: '健康检查',
    description: '查看服务运行状态',
  },
  {
    href: '/api',
    icon: 'fa-book',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    iconBgHover: 'group-hover:bg-purple-100',
    title: 'API 文档',
    description: '查看完整接口定义',
  },
  {
    href: '/api/search?q=钻石&pretty=true',
    icon: 'fa-magnifying-glass',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    iconBgHover: 'group-hover:bg-orange-100',
    title: 'GET 搜索示例',
    description: '直接调用搜索接口',
  },
  {
    href: '/api/page/钻石?pretty=true',
    icon: 'fa-file-code',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    iconBgHover: 'group-hover:bg-teal-100',
    title: 'GET 页面示例',
    description: '获取单页面JSON',
  },
  {
    href: '/api/page/工作台?format=wikitext&pretty=true',
    icon: 'fa-code',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    iconBgHover: 'group-hover:bg-indigo-100',
    title: 'GET Wikitext',
    description: '获取页面源代码',
  },
];

export function QuickLinks() {
  return (
    <section>
      <div className="flex items-center gap-2 mb-6">
        <i className="fa-solid fa-bolt text-emerald-500"></i>
        <h2 className="text-lg font-semibold text-slate-900">快速导航</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {links.map((link, index) => (
          <a
            key={index}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200"
          >
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2 ${link.iconBg} ${link.iconColor} rounded-lg ${link.iconBgHover} transition-colors`}>
                <i className={`fa-solid ${link.icon}`}></i>
              </div>
              <i className="fa-solid fa-arrow-up-right-from-square text-slate-300 group-hover:text-emerald-500 text-xs"></i>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{link.title}</h3>
            <p className="text-sm text-slate-500">{link.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}