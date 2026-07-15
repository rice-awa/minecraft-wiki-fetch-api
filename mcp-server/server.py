"""Minecraft Wiki MCP Server — 提供搜索和页面抓取工具"""

import os
from typing import Annotated
from urllib.parse import quote
import httpx
from mcp.server.fastmcp import FastMCP
from pydantic import Field

API_BASE = os.getenv("API_BASE_URL", "http://localhost:3000")

mcp = FastMCP("Minecraft Wiki", host="0.0.0.0", port=3001)


@mcp.tool()
async def search_wiki(
    q: Annotated[str, Field(description="搜索关键词，支持中文。例如 '钻石'、'红石'、'命令'")],
    limit: Annotated[int, Field(description="返回结果数量，默认 10，最大 50")] = 10,
    namespaces: Annotated[list[int], Field(default=[], description="限定命名空间，数字ID列表。0=Main 10=Template 14=Category 9994=Module。空则使用默认值")] = [],
) -> str:
    """搜索 Minecraft 中文 Wiki。

    根据关键词查找匹配的 Wiki 页面，返回标题、URL 和摘要。
    当你需要了解某个游戏概念、物品、机制时使用此工具。"""
    try:
        params: dict = {"q": q, "limit": min(limit, 50)}
        if namespaces:
            params["namespaces"] = ",".join(str(n) for n in namespaces)
        async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
            resp = await client.get(f"{API_BASE}/api/search", params=params)
            data = resp.json()
    except Exception as e:
        return f"搜索失败: API 服务不可用 ({e})"

    if not data.get("success"):
        return f"搜索失败: {data.get('error', {}).get('message', '未知错误')}"

    results = data["data"]["results"]
    if not results:
        return f"未找到与 '{q}' 相关的页面。"

    lines = [f"搜索 '{q}' 的结果 ({len(results)} 条):\n"]
    for r in results:
        snippet = r["snippet"].replace("\n", " ")[:150]
        lines.append(f"- **{r['title']}** ({r['namespace']})")
        lines.append(f"  {r['url']}")
        lines.append(f"  {snippet}")
        lines.append("")
    return "\n".join(lines)


@mcp.tool()
async def get_page(
    pageName: Annotated[str, Field(description="页面名称，支持中文。例如 '钻石'、'工作台'、'命令'")],
    format: Annotated[
        str,
        Field(
            default="wikitext",
            description="输出格式：wikitext（默认，最完整，推荐）、markdown、html（仅在 wikitext 模板无法理解时使用）",
        ),
    ] = "wikitext",
    useCache: Annotated[bool, Field(description="是否使用缓存，默认 true")] = True,
    includeMetadata: Annotated[bool, Field(description="是否包含元数据，默认 true")] = True,
) -> str:
    """获取 Minecraft 中文 Wiki 页面的内容。

    根据页面名称获取 Wiki 页面的完整内容，支持三种格式。

    格式选择建议：
    - wikitext（默认，推荐）：最完整的格式，包含 Wiki 原始标记语言。
      所有信息框、历史表格、配方等模板数据均以 {{Template}} 形式完整保留。
      绝大多数情况下应优先使用 wikitext。
    - markdown：HTML 转 Markdown，适合易读场景，部分复杂模板可能丢失。
    - html：清洗后的正文 HTML。仅在 wikitext 中某个模板无法理解时使用。非必要不用。"""
    valid_formats = ("wikitext", "markdown", "html")
    if format not in valid_formats:
        return f"无效的 format: {format}，可选值: {', '.join(valid_formats)}"

    try:
        params = {"format": format, "useCache": str(useCache).lower()}
        async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
            resp = await client.get(
                f"{API_BASE}/api/page/{quote(pageName, safe='')}",
                params=params,
            )
            data = resp.json()
    except Exception as e:
        return f"页面获取失败: API 服务不可用 ({e})"

    if not data.get("success"):
        error = data.get("error", {})
        code = error.get("code", "")
        if code == "PAGE_NOT_FOUND":
            return f"页面 '{pageName}' 不存在。可尝试使用 search_wiki 搜索正确的页面名称。"
        return f"获取页面失败: {error.get('message', '未知错误')}"

    page = data["data"]["page"]

    if format == "wikitext":
        content = page["content"]["wikitext"]
    elif format == "markdown":
        content = page["content"]["markdown"]
    elif format == "html":
        content = page["content"]["html"]

    info_lines = [f"# {page['pageName']}", f"URL: {page['url']}"]

    if includeMetadata:
        meta = page.get("meta", {})
        info_lines.append(
            f"格式: {format}  |  字数: {meta.get('wordCount', 'N/A')}  |  段落: {meta.get('sectionCount', 'N/A')}"
        )
    else:
        info_lines.append(f"格式: {format}")

    info_lines.extend(["", content])
    return "\n".join(info_lines)


@mcp.tool()
async def check_page_exists(
    pageName: Annotated[str, Field(description="页面名称，支持中文")],
) -> str:
    """检查页面是否存在。"""
    try:
        async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
            resp = await client.get(f"{API_BASE}/api/page/{quote(pageName, safe='')}/exists")
            data = resp.json()
    except Exception as e:
        return f"检查失败: API 服务不可用 ({e})"

    if not data.get("success"):
        return f"检查失败: {data.get('error', {}).get('message', '未知错误')}"

    info = data["data"]
    if info["exists"]:
        pi = info.get("pageInfo", {})
        lines = [f"页面 '{pageName}' 存在。"]
        if pi:
            lines.append(f"页面ID: {pi.get('pageid')}")
            lines.append(f"长度: {pi.get('length')} 字节")
            lines.append(f"最后修改: {pi.get('touched')}")
        if info.get("redirected"):
            actualTitle = pi.get("title", pageName)
            lines.append(f"重定向到: {actualTitle}")
        return "\n".join(lines)
    else:
        return f"页面 '{pageName}' 不存在。"


@mcp.tool()
async def check_health() -> str:
    """检查 Wiki API 服务健康状态。"""
    try:
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            resp = await client.get(f"{API_BASE}/health")
            data = resp.json()
    except Exception as e:
        return f"API 服务不可用: {e}"

    if not data.get("status"):
        return f"API 返回异常: {data}"

    mem = data.get("memory", {})
    svc = data.get("service", {})
    lines = [
        f"状态: {data.get('status', 'unknown')}",
        f"运行时间: {data.get('uptime', {}).get('human', 'N/A')}",
        f"环境: {svc.get('environment', 'N/A')}",
        f"内存: {mem.get('used', '?')} / {mem.get('total', '?')} (系统 {mem.get('system', '?')})",
    ]
    return "\n".join(lines)


@mcp.tool()
async def list_namespaces() -> str:
    """获取 Minecraft Wiki 的命名空间映射表。

    返回所有可用命名空间的数字 ID 和对应名称。
    结合 search_wiki 的 namespaces 参数使用。"""
    try:
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            resp = await client.get(f"{API_BASE}/api/search/namespaces")
            data = resp.json()
    except Exception as e:
        return f"获取命名空间失败: {e}"

    if not data.get("success"):
        return "获取命名空间失败"

    ns = data["data"]["namespaces"]
    lines = ["命名空间映射表：\n"]
    for k, v in ns.items():
        lines.append(f"  {k} → {v}")
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
