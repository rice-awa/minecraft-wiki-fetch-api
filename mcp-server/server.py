"""Minecraft Wiki MCP Server — 提供搜索和页面抓取工具"""

import os
from typing import Annotated
from urllib.parse import quote
import httpx
from mcp.server import MCPServer
from pydantic import Field

API_BASE = os.getenv("API_BASE_URL", "http://localhost:3000")
MCP_PORT = int(os.getenv("MCP_PORT", "3001"))

mcp = MCPServer("Minecraft Wiki")


@mcp.tool(structured_output=False)
async def search_wiki(
    q: Annotated[str, Field(description="搜索关键词，1-3个游戏名词为佳。多关键词会缩小而非扩大范围，因为所有词都需出现在结果页面中。如需多角度搜索，分别调用本工具即可。这不是搜索引擎，不要堆砌关键词。例：'信标 激活'，而不是 '信标 激活 怎么做 教程 步骤'")],
    limit: Annotated[int, Field(description="返回结果数量，默认 10，最大 50")] = 10,
    namespaces: Annotated[list[int], Field(default=[], description="限定命名空间，数字ID列表。0=Main 10=Template 14=Category 9994=Module。空则使用默认值")] = [],
) -> str:
    """搜索 Minecraft 中文 Wiki。

    用1-3个游戏名词查找匹配的页面。多关键词会缩小范围（所有词须同时出现在结果页面中），
    如需多角度搜索应分批调用本工具，而非把大量关键词堆在一次查询中。"""
    try:
        params: dict = {"q": q, "limit": min(limit, 50)}
        if namespaces:
            params["namespaces"] = ",".join(str(n) for n in namespaces)
        async with httpx.AsyncClient(timeout=60, trust_env=False) as client:
            resp = await client.get(f"{API_BASE}/api/search", params=params)
            data = resp.json()
    except Exception as e:
        return f"搜索失败: API 服务不可用 ({e})"

    if not data.get("success"):
        return f"搜索失败: {(data.get('error', {}).get('message') or data.get('error', {}).get('code') or '未知错误')}"

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


@mcp.tool(structured_output=False)
async def get_page(
    pageName: Annotated[str, Field(description="页面名称，支持中文。例如 '钻石'、'工作台'、'命令'")],
    format: Annotated[
        str,
        Field(
            default="wikitext",
description="**非必要不要传此参数，默认 wikitext 就是最好的。** wikitext 完全保留模板语义；html 仅在 wikitext 模板确实无法理解时使用",
        ),
    ] = "wikitext",
    useCache: Annotated[bool, Field(description="是否使用缓存，默认 true")] = True,
    includeMetadata: Annotated[bool, Field(description="是否包含元数据，默认 true")] = True,
    followRedirect: Annotated[bool, Field(description="是否跟随重定向，默认 true。false 时返回重定向页自身内容（wikitext 为 #REDIRECT 源码）")] = True,
    title: Annotated[str | None, Field(description="只获取该标题（章节，含子章节）下的内容，传标题文本且不含 == 符号，例如 '获取'。可用 get_page_toc 查看全部标题")] = None,
    offset: Annotated[int, Field(description="从内容的第几行开始返回，默认 0", ge=0)] = 0,
    limit: Annotated[int, Field(description="最多返回的行数，默认 500，最大 5000；0 表示不限制", ge=0, le=5000)] = 500,
) -> str:
    """获取 Minecraft 中文 Wiki 页面的内容。

    根据页面名称获取 Wiki 页面的完整内容。

    格式选择：
    - wikitext（默认）：Wiki 原始标记语言，{{Template}} 完整保留，信息最全。
    - html：清洗后的正文 HTML。仅当 wikitext 中某个模板语法确实无法理解时才使用。

    wikitext 中遇到不认识的 {{Template}} 时，可用 search_wiki 传 namespaces=[10] 去模板命名空间搜索该模板的文档。

    读取大页面时：
    - 先用 get_page_toc 查看章节目录
    - 用 title 只读取某一章节（含子章节）
    - 章节仍然很大时，用 offset/limit 按行分片"""
    valid_formats = ("wikitext", "html")
    if format not in valid_formats:
        return f"无效的 format: {format}，可选值: {', '.join(valid_formats)}"

    try:
        params = {
            "format": format,
            "useCache": str(useCache).lower(),
            "followRedirect": str(followRedirect).lower(),
        }
        if title:
            params["title"] = title
        async with httpx.AsyncClient(timeout=60, trust_env=False) as client:
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
        if code == "SECTION_NOT_FOUND":
            available = (error.get("details") or {}).get("availableTitles") or []
            message = f"页面 '{pageName}' 中未找到标题 '{title}'。可先用 get_page_toc 查看章节目录。"
            if available:
                message += "\n可用标题: " + "、".join(available[:30])
            return message
        return f"获取页面失败: {(error.get('message') or code or '未知错误')}"

    page = data["data"]["page"]

    if format == "wikitext":
        content = page["content"]["wikitext"]
    else:
        content = page["content"]["html"]

    # 按行切片
    slice_note = ""
    if offset or limit:
        lines = content.split("\n")
        total = len(lines)
        start = min(offset, total)
        end = min(start + limit, total) if limit else total
        selected = lines[start:end]
        content = "\n".join(selected)
        if selected:
            end_line = start + len(selected)
            slice_note = f"[切片] 第 {start + 1}-{end_line} 行 / 共 {total} 行"
            if end < total:
                slice_note += f"；继续读取请传 offset={end_line}"
        else:
            slice_note = f"[切片] offset={offset} 超出内容范围（共 {total} 行）"

    info_lines = [f"# {page['pageName']}", f"URL: {page['url']}"]

    redirect = page.get("redirect")
    if redirect:
        info_lines.append(f"重定向: {redirect.get('from')} → {redirect.get('to')}")

    section = page.get("section")
    if section:
        number = section.get("number") or ""
        info_lines.append(f"章节: {number} {section.get('title', '')}（含子章节）")

    if includeMetadata:
        meta = page.get("meta", {})
        info_lines.append(f"格式: {format}  |  字数: {meta.get('wordCount', 'N/A')}")
    else:
        info_lines.append(f"格式: {format}")

    info_lines.extend(["", content])
    if slice_note:
        info_lines.extend(["", "---", slice_note])
    return "\n".join(info_lines)


@mcp.tool(structured_output=False)
async def get_page_toc(
    pageName: Annotated[str, Field(description="页面名称，支持中文。例如 '信标'、'命令'")],
    useCache: Annotated[bool, Field(description="是否使用缓存，默认 true")] = True,
    followRedirect: Annotated[bool, Field(description="是否跟随重定向，默认 true")] = True,
) -> str:
    """获取页面的章节目录。

    返回每个章节的层级、标题与编号。先用本工具确定目录，再用 get_page 的 title 参数
    只读取某一章节（含子章节），章节仍然很大时配合 offset/limit 分片。"""
    try:
        async with httpx.AsyncClient(timeout=60, trust_env=False) as client:
            resp = await client.get(
                f"{API_BASE}/api/page/{quote(pageName, safe='')}/toc",
                params={
                    "useCache": str(useCache).lower(),
                    "followRedirect": str(followRedirect).lower(),
                },
            )
            data = resp.json()
    except Exception as e:
        return f"获取目录失败: API 服务不可用 ({e})"

    if not data.get("success"):
        error = data.get("error", {})
        code = error.get("code", "")
        if code == "PAGE_NOT_FOUND":
            return f"页面 '{pageName}' 不存在。可尝试使用 search_wiki 搜索正确的页面名称。"
        return f"获取目录失败: {(error.get('message') or code or '未知错误')}"

    toc = data.get("data", {})
    sections = toc.get("sections") or []
    page_title = toc.get("pageName") or pageName
    redirect = toc.get("redirect")
    redirect_note = (
        f"（重定向: {redirect.get('from')} → {redirect.get('to')}）" if redirect else ""
    )

    if not sections:
        return f"页面 '{page_title}' 没有章节标题（内容可能很短，可直接读取全文）。{redirect_note}"

    lines = [f"# {page_title} 目录（{len(sections)} 个章节）{redirect_note}", ""]
    for section in sections:
        level = section.get("level") or 2
        indent = "  " * max(0, level - 2)
        number = section.get("number") or ""
        title = section.get("title") or ""
        lines.append(f"{indent}- [{number}] {title}")
    lines.extend(["", "用 get_page(title=...) 只读取某一章节（含子章节）。"])
    return "\n".join(lines)


@mcp.tool(structured_output=False)
async def check_page_exists(
    pageName: Annotated[str, Field(description="页面名称，支持中文")],
) -> str:
    """检查页面是否存在。"""
    try:
        async with httpx.AsyncClient(timeout=60, trust_env=False) as client:
            resp = await client.get(f"{API_BASE}/api/page/{quote(pageName, safe='')}/exists")
            data = resp.json()
    except Exception as e:
        return f"检查失败: API 服务不可用 ({e})"

    if not data.get("success"):
        return f"检查失败: {(data.get('error', {}).get('message') or data.get('error', {}).get('code') or '未知错误')}"

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


@mcp.tool(structured_output=False)
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


@mcp.tool(structured_output=False)
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
        return f"获取命名空间失败: {(data.get('error', {}).get('message') or data.get('error', {}).get('code') or '未知错误')}"

    ns = data["data"]["namespaces"]
    lines = ["命名空间映射表：\n"]
    for k, v in ns.items():
        lines.append(f"  {k} → {v}")
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=MCP_PORT)
