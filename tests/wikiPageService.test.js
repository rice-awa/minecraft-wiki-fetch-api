/**
 * WikiPageService Integration Tests
 * 测试完整的页面获取流程，包括URL处理、内容解析和Markdown转换
 */

const WikiPageService = require('../src/services/wikiPageService');

// 模拟HTTP客户端
const mockHttpClient = {
    get: jest.fn()
};

// 模拟的Wiki页面HTML内容
const mockWikiPageHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>钻石 - Minecraft Wiki</title>
</head>
<body>
    <div id="mw-head"></div>
    <div id="content">
        <h1 id="firstHeading">钻石</h1>
        <div id="contentSub">来自Minecraft Wiki</div>
        
        <div id="mw-content-text">
            <div class="mw-parser-output">
                <div class="infobox">
                    <div class="infobox-title">钻石</div>
                    <table>
                        <tr><th>类型</th><td>材料</td></tr>
                        <tr><th>稀有度</th><td>罕见</td></tr>
                    </table>
                </div>
                
                <p><strong>钻石</strong>是游戏中最珍贵的材料之一。</p>
                
                <div id="toc" class="toc">
                    <div class="toctitle">目录</div>
                    <ul>
                        <li><a href="#获取">1 获取</a></li>
                        <li><a href="#用途">2 用途</a></li>
                    </ul>
                </div>
                
                <h2 id="获取">获取</h2>
                <p>钻石可以通过开采钻石矿石获得。</p>
            </div>
        </div>
        
        <div id="mw-normal-catlinks">
            <a href="/wiki/Category:Materials" title="Category:Materials">材料</a>
        </div>
    </div>
</body>
</html>
`;

// 模拟API响应
const mockApiExistsResponse = {
    data: {
        query: {
            pages: {
                '12345': {
                    pageid: 12345,
                    title: '钻石',
                    contentmodel: 'wikitext'
                }
            }
        }
    }
};

const mockApiNotExistsResponse = {
    data: {
        query: {
            pages: {
                '-1': {
                    title: '不存在的页面',
                    missing: true
                }
            }
        }
    }
};

const mockSearchSuggestionsResponse = {
    data: [
        '不存在',
        ['钻石', '钻石矿石', '钻石工具'],
        ['钻石描述', '钻石矿石描述', '钻石工具描述'],
        ['https://zh.minecraft.wiki/w/钻石', 'https://zh.minecraft.wiki/w/钻石矿石', 'https://zh.minecraft.wiki/w/钻石工具']
    ]
};

describe('WikiPageService Integration Tests', () => {
    let service;
    let originalHttpClient;

    beforeEach(() => {
        // 创建服务实例
        service = new WikiPageService({
            cacheOptions: { enabled: false } // 禁用缓存以便测试
        });
        
        // 保存原始HTTP客户端并注入模拟
        originalHttpClient = service.httpClient;
        service.httpClient = mockHttpClient;
        
        // 重置模拟
        jest.clearAllMocks();
        mockHttpClient.get.mockReset();
    });

    afterEach(() => {
        // 恢复原始HTTP客户端
        service.httpClient = originalHttpClient;
    });

    describe('getPage', () => {
        test('should get complete page content successfully', async () => {
            // 设置模拟响应
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse) // 页面存在检查
                .mockResolvedValueOnce({ data: mockWikiPageHtml }); // 页面HTML

            const result = await service.getPage('钻石', { format: 'both' });

            expect(result.success).toBe(true);
            expect(result.data.pageName).toBe('钻石');
            expect(result.data.title).toBe('钻石');
            expect(result.data.content.html).toBeTruthy();
            expect(result.data.content.markdown).toBeTruthy();
            expect(result.data.content.components).toBeTruthy();
            expect(result.data.categories).toHaveLength(1);
            expect(result.data.metadata).toBeTruthy();
        });

        test('should get page content in HTML format only', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml });

            const result = await service.getPage('钻石', { format: 'html' });

            expect(result.success).toBe(true);
            expect(result.data.content.html).toBeTruthy();
            expect(result.data.content.markdown).toBeUndefined();
            expect(result.data.content.components).toBeTruthy();
        });

        test('should get page content in Markdown format only', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml });

            const result = await service.getPage('钻石', { format: 'markdown' });

            expect(result.success).toBe(true);
            expect(result.data.content.markdown).toBeTruthy();
            expect(result.data.content.html).toBeUndefined();
            expect(result.data.content.components).toBeUndefined();
        });

        test('should handle page not found', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiNotExistsResponse) // 页面不存在
                .mockResolvedValueOnce(mockSearchSuggestionsResponse); // 搜索建议

            const result = await service.getPage('不存在的页面');

            expect(result.success).toBe(false);
            expect(result.error.code).toBe('PAGE_NOT_FOUND');
            expect(result.error.details.suggestions).toHaveLength(3);
        });

        test('should handle HTTP error', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockRejectedValueOnce(new Error('网络错误'));

            const result = await service.getPage('钻石');

            expect(result.success).toBe(false);
            expect(result.error.code).toBe('HTML_FETCH_ERROR');
        });

        test('should validate input parameters', async () => {
            const result1 = await service.getPage('');
            expect(result1.success).toBe(false);
            expect(result1.error.message).toContain('页面名称必须是非空字符串');

            const result2 = await service.getPage(null);
            expect(result2.success).toBe(false);

            const result3 = await service.getPage(123);
            expect(result3.success).toBe(false);
        });

        test('should process page components correctly', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml });

            const result = await service.getPage('钻石', { format: 'html' });

            expect(result.success).toBe(true);
            
            const { components } = result.data.content;
            expect(components.sections).toBeTruthy();
            expect(components.infoboxes).toBeTruthy();
            expect(components.toc).toBeTruthy();
            
            // 检查元数据统计
            expect(result.data.meta.wordCount).toBeGreaterThan(0);
            expect(result.data.meta.sectionCount).toBeGreaterThan(0);
        });
    });

    describe('checkPageExists', () => {
        test('should confirm existing page', async () => {
            mockHttpClient.get.mockResolvedValueOnce(mockApiExistsResponse);

            const result = await service.checkPageExists('钻石');

            expect(result.exists).toBe(true);
            expect(result.pageInfo.title).toBe('钻石');
            expect(result.redirected).toBe(false);
        });

        test('should handle non-existing page', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiNotExistsResponse)
                .mockResolvedValueOnce(mockSearchSuggestionsResponse);

            const result = await service.checkPageExists('不存在的页面');

            expect(result.exists).toBe(false);
            expect(result.suggestions).toHaveLength(3);
        });

        test('should handle redirected page', async () => {
            const redirectResponse = {
                data: {
                    query: {
                        redirects: [{ from: '钻石矿', to: '钻石矿石' }],
                        pages: {
                            '67890': {
                                pageid: 67890,
                                title: '钻石矿石',
                                contentmodel: 'wikitext'
                            }
                        }
                    }
                }
            };

            mockHttpClient.get.mockResolvedValueOnce(redirectResponse);

            const result = await service.checkPageExists('钻石矿');

            expect(result.exists).toBe(true);
            expect(result.redirected).toBe(true);
            expect(result.pageInfo.title).toBe('钻石矿石');
        });
    });

    describe('getPages', () => {
        test('should get multiple pages successfully', async () => {
            // 为每个页面设置模拟响应
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse) // 钻石存在检查
                .mockResolvedValueOnce({ data: mockWikiPageHtml }) // 钻石HTML
                .mockResolvedValueOnce(mockApiExistsResponse) // 第二个页面存在检查
                .mockResolvedValueOnce({ data: mockWikiPageHtml }); // 第二个页面HTML

            const result = await service.getPages(['钻石', '金锭'], { 
                format: 'markdown',
                concurrency: 2 
            });

            expect(result.success).toBe(true);
            expect(result.data.totalPages).toBe(2);
            expect(result.data.successCount).toBe(2);
            expect(result.data.errorCount).toBe(0);
            expect(result.data.results['钻石']).toBeTruthy();
            expect(result.data.results['金锭']).toBeTruthy();
        });

        test('should handle mixed success and failure', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse) // 钻石存在
                .mockResolvedValueOnce({ data: mockWikiPageHtml }) // 钻石HTML
                .mockResolvedValueOnce(mockApiNotExistsResponse) // 不存在的页面
                .mockResolvedValueOnce(mockSearchSuggestionsResponse); // 搜索建议

            const result = await service.getPages(['钻石', '不存在的页面'], { concurrency: 1 });

            expect(result.success).toBe(true);
            expect(result.data.totalPages).toBe(2);
            expect(result.data.results['钻石'].success).toBe(true);
            expect(result.data.results['不存在的页面'].success).toBe(false);
        });

        test('should validate input parameters', async () => {
            const result1 = await service.getPages([]);
            expect(result1.success).toBe(false);
            expect(result1.error.code).toBe('INVALID_INPUT');

            const result2 = await service.getPages(null);
            expect(result2.success).toBe(false);

            const result3 = await service.getPages('not an array');
            expect(result3.success).toBe(false);
        });
    });

    describe('caching', () => {
        beforeEach(() => {
            // 为缓存测试启用缓存
            service = new WikiPageService({
                cacheOptions: { 
                    enabled: true, 
                    ttl: 1000, // 1秒TTL，便于测试
                    maxSize: 2 
                }
            });
            service.httpClient = mockHttpClient;
        });

        test('should cache and retrieve page results', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml });

            // 第一次获取
            const result1 = await service.getPage('钻石');
            expect(result1.success).toBe(true);
            expect(mockHttpClient.get).toHaveBeenCalledTimes(2);

            // 第二次获取，应该从缓存返回
            const result2 = await service.getPage('钻石');
            expect(result2.success).toBe(true);
            expect(mockHttpClient.get).toHaveBeenCalledTimes(2); // 没有额外调用
        });

        test('should respect cache TTL', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml })
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml });

            // 第一次获取
            await service.getPage('钻石');
            expect(mockHttpClient.get).toHaveBeenCalledTimes(2);

            // 等待TTL过期
            await new Promise(resolve => setTimeout(resolve, 1100));

            // 再次获取，应该重新请求
            await service.getPage('钻石');
            expect(mockHttpClient.get).toHaveBeenCalledTimes(4);
        });

        test('should handle cache eviction', async () => {
            // 添加两个页面到缓存（达到maxSize）
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml })
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml })
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml });

            await service.getPage('钻石');
            await service.getPage('金锭');

            const stats = service.getCacheStats();
            expect(stats.size).toBe(2);

            // 添加第三个页面，应该驱逐最旧的
            await service.getPage('铁锭');
            
            const statsAfter = service.getCacheStats();
            expect(statsAfter.size).toBe(2); // 仍然是2，因为最大大小限制
        });

        test('should clear cache correctly', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml });

            await service.getPage('钻石');
            
            let stats = service.getCacheStats();
            expect(stats.size).toBe(1);

            service.clearCache('钻石');
            
            stats = service.getCacheStats();
            expect(stats.size).toBe(0);
        });

        test('should return deep clone from cache to prevent mutation', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml });

            const result1 = await service.getPage('钻石', { format: 'html' });
            expect(result1.success).toBe(true);

            result1.data.title = 'MUTATED';
            result1.data.content.html = 'MUTATED';

            const result2 = await service.getPage('钻石', { format: 'html' });
            expect(result2.success).toBe(true);
            expect(result2.data.title).toBe('钻石');
            expect(result2.data.content.html).not.toBe('MUTATED');
        });
    });

    describe('configuration and utilities', () => {
        test('should update service options', () => {
            const newOptions = {
                baseUrl: 'https://new.wiki',
                cacheOptions: { ttl: 600000 }
            };

            service.updateOptions(newOptions);
            
            const options = service.getOptions();
            expect(options.baseUrl).toBe('https://new.wiki');
            expect(options.cacheOptions.ttl).toBe(600000);
        });

        test('should provide cache statistics', () => {
            const stats = service.getCacheStats();
            
            if (stats.enabled) {
                expect(stats).toHaveProperty('size');
                expect(stats).toHaveProperty('maxSize');
                expect(stats).toHaveProperty('ttl');
            } else {
                expect(stats.enabled).toBe(false);
            }
        });

        test('should handle service errors gracefully', async () => {
            // 模拟内部组件错误
            const originalParser = service.contentParser;
            service.contentParser = {
                parsePageContent: jest.fn().mockReturnValue({
                    success: false,
                    error: { code: 'PARSE_ERROR', message: '解析失败' }
                })
            };

            mockHttpClient.get
                .mockResolvedValueOnce(mockApiExistsResponse)
                .mockResolvedValueOnce({ data: mockWikiPageHtml });

            const result = await service.getPage('钻石');

            expect(result.success).toBe(false);
            expect(result.error.code).toBe('PARSE_ERROR');

            // 恢复原始解析器
            service.contentParser = originalParser;
        });
    });

    describe('error handling', () => {
        test('should propagate network errors in checkPageExists', async () => {
            mockHttpClient.get.mockRejectedValueOnce(new Error('API错误'));

            await expect(service.checkPageExists('钻石')).rejects.toThrow('API错误');
        });

        test('should handle malformed API responses', async () => {
            mockHttpClient.get.mockResolvedValueOnce({ data: null });

            const result = await service.checkPageExists('钻石');

            expect(result.exists).toBe(false);
        });

        test('should handle network timeouts', async () => {
            mockHttpClient.get.mockRejectedValueOnce(new Error('TIMEOUT'));

            const result = await service.getPage('钻石');

            expect(result.success).toBe(false);
            expect(result.error.code).toBe('PAGE_FETCH_ERROR');
        });
    });
});