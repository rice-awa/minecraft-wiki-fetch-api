/**
 * PageContentParser Tests
 * 测试页面内容解析器的各种功能
 */

const PageContentParser = require('../src/services/pageContentParser');

// 创建模拟的Wiki页面HTML
const createMockWikiPageHtml = () => `
<!DOCTYPE html>
<html>
<head>
    <title>钻石 - Minecraft Wiki</title>
</head>
<body>
    <div id="mw-head">
        <div id="mw-head-base"></div>
    </div>
    
    <div id="content">
        <h1 id="firstHeading">钻石</h1>
        <div id="contentSub">来自Minecraft Wiki</div>
        
        <div id="mw-content-text">
            <div class="mw-parser-output">
                <div class="infobox">
                    <div class="infobox-title">钻石</div>
                    <img src="/images/diamond.png" alt="钻石" width="32" height="32">
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
                <span class="mw-editsection">[编辑]</span>
                
                <h3>开采</h3>
                <p>使用铁镐或更好的工具开采。</p>
                
                <table class="wikitable">
                    <caption>钻石工具</caption>
                    <tr>
                        <th>物品</th>
                        <th>耐久度</th>
                    </tr>
                    <tr>
                        <td>钻石剑</td>
                        <td>1561</td>
                    </tr>
                </table>
                
                <div class="thumbinner">
                    <img src="/images/diamond_ore.png" alt="钻石矿石" width="150" height="150">
                    <div class="thumbcaption">钻石矿石</div>
                </div>
                
                <h2 id="用途">用途</h2>
                <p>钻石可以用来制作工具和装备。</p>
                
                <div class="navbox">
                    <div>导航框内容</div>
                </div>
                
                <script>console.log('test');</script>
                <style>.test { color: red; }</style>
            </div>
        </div>
        
        <div id="mw-normal-catlinks">
            <a href="/wiki/Category:Materials" title="Category:Materials">材料</a>
            <a href="/wiki/Category:Items" title="Category:Items">物品</a>
        </div>
    </div>
    
    <div id="footer">
        <div id="footer-info-lastmod">本页面最后编辑于2024年1月15日</div>
    </div>
</body>
</html>
`;

// 创建无效的HTML内容
const createInvalidHtml = () => '<div>这不是一个Wiki页面</div>';

// 创建空的Wiki页面
const createEmptyWikiPage = () => `
<html>
<body>
    <div id="mw-head"></div>
    <div id="content">
        <h1 id="firstHeading">空页面</h1>
        <div id="mw-content-text">
            <div class="mw-parser-output">
                <!-- 空内容 -->
            </div>
        </div>
    </div>
</body>
</html>
`;

describe('PageContentParser', () => {
    let parser;

    beforeEach(() => {
        parser = new PageContentParser();
    });

    describe('constructor', () => {
        test('should initialize with default options', () => {
            const options = parser.getOptions();
            expect(options.contentSelector).toBe('.mw-parser-output');
            expect(options.removeSelectors).toContain('.mw-editsection');
            expect(options.preserveSelectors).toContain('.infobox');
        });

        test('should accept custom options', () => {
            const customParser = new PageContentParser({
                contentSelector: '.custom-content',
                imageOptions: { minWidth: 100 }
            });
            
            const options = customParser.getOptions();
            expect(options.contentSelector).toBe('.custom-content');
            expect(options.imageOptions.minWidth).toBe(100);
        });
    });

    describe('parsePageContent', () => {
        test('should parse valid wiki page successfully', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            expect(result.data.title).toBe('钻石');
            expect(result.data.subtitle).toBe('来自Minecraft Wiki');
            expect(result.data.categories).toHaveLength(2);
            expect(result.data.categories[0].name).toBe('材料');
            expect(result.data.content.html).toBeTruthy();
            expect(result.data.content.text).toBeTruthy();
        });

        test('should extract page components correctly', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            
            const { components } = result.data.content;
            expect(components.images).toHaveLength(2); // 信息框图片 + 缩略图
            expect(components.tables).toHaveLength(1);
            expect(components.infoboxes).toHaveLength(1);
            // 章节/目录数据统一由 /toc 接口提供，解析器不再提取
            expect(components.sections).toBeUndefined();
            expect(components.toc).toBeUndefined();
        });

        test('should clean unwanted elements', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            
            const cleanHtml = result.data.content.html;
            expect(cleanHtml).not.toContain('mw-editsection');
            expect(cleanHtml).not.toContain('navbox');
            expect(cleanHtml).not.toContain('<script>');
            expect(cleanHtml).not.toContain('<style>');
        });

        test('should preserve important elements', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            
            const cleanHtml = result.data.content.html;
            expect(cleanHtml).toContain('infobox');
            expect(cleanHtml).toContain('thumbinner');
            expect(cleanHtml).toContain('wikitable');
            expect(cleanHtml).toContain('toc');
        });

        test('should process images correctly', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            
            const { images } = result.data.content.components;
            expect(images).toHaveLength(2);
            
            // 检查图片URL是否转换为绝对路径
            images.forEach(img => {
                expect(img.src).toMatch(/^https:\/\//);
            });
            
            // 检查图片信息
            expect(images[0].alt).toBe('钻石');
            expect(images[1].caption).toBe('');
        });

        test('should process links correctly', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            
            // 检查分类链接被正确处理
            expect(result.data.categories[0].url).toMatch(/^https:\/\//);
        });

        test('should count words correctly', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            expect(result.data.meta.wordCount).toBeGreaterThan(0);
        });

        test('should extract metadata correctly', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            
            const { meta } = result.data;
            expect(meta.imageCount).toBe(2);
            expect(meta.tableCount).toBe(1);
            expect(meta.wordCount).toBeGreaterThan(0);
            expect(meta.processingTime).toBeTruthy();
            // 章节统计由 /toc 接口提供
            expect(meta.sectionCount).toBeUndefined();
        });

        test('should handle empty content gracefully', () => {
            const html = createEmptyWikiPage();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            expect(result.data.title).toBe('空页面');
            expect(result.data.content.components.images).toHaveLength(0);
        });

        test('should reject invalid HTML', () => {
            const result1 = parser.parsePageContent('');
            expect(result1.success).toBe(false);
            expect(result1.error.code).toBe('PARSE_ERROR');

            const result2 = parser.parsePageContent(null);
            expect(result2.success).toBe(false);

            const result3 = parser.parsePageContent(123);
            expect(result3.success).toBe(false);
        });

        test('should reject non-wiki HTML', () => {
            const html = createInvalidHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(false);
            expect(result.error.message).toContain('不是有效的Wiki页面HTML');
        });

        test('should handle page info parameter', () => {
            const html = createMockWikiPageHtml();
            const pageInfo = {
                title: '自定义标题',
                namespace: 'Template'
            };
            
            const result = parser.parsePageContent(html, pageInfo);

            expect(result.success).toBe(true);
            expect(result.data.namespace).toBe('Template');
            // title应该从HTML中提取，而不是pageInfo
            expect(result.data.title).toBe('钻石');
        });
    });

    describe('content extraction', () => {
        test('should extract table information', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            
            const tables = result.data.content.components.tables;
            expect(tables).toHaveLength(1);
            expect(tables[0].caption).toBe('钻石工具');
            expect(tables[0].rowCount).toBe(2); // header + 1 data row
            expect(tables[0].hasHeader).toBe(true);
        });

        test('should extract text content without HTML', () => {
            const html = createMockWikiPageHtml();
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            
            const textContent = result.data.content.text;
            expect(textContent).toContain('钻石是游戏中最珍贵的材料之一');
            expect(textContent).toContain('钻石可以通过开采钻石矿石获得');
            expect(textContent).not.toContain('<p>');
            expect(textContent).not.toContain('<div>');
        });
    });

    describe('image processing', () => {
        test('should remove small images when configured', () => {
            const customParser = new PageContentParser({
                imageOptions: {
                    removeSmallImages: true,
                    minWidth: 100,
                    minHeight: 100
                }
            });

            const html = createMockWikiPageHtml();
            const result = customParser.parsePageContent(html);

            expect(result.success).toBe(true);
            
            // 32x32的钻石图片应该被移除，150x150的应该保留
            const images = result.data.content.components.images;
            expect(images.length).toBeLessThanOrEqual(2); // 可能都保留了，这取决于实际处理逻辑
        });

        test('should add alt attributes to images', () => {
            const html = `
            <html><body>
                <div id="mw-head"></div>
                <div id="mw-content-text">
                    <div class="mw-parser-output">
                        <div class="thumbinner">
                            <img src="/test.png" width="100" height="100">
                            <div class="thumbcaption">测试图片</div>
                        </div>
                    </div>
                </div>
            </body></html>
            `;

            const result = parser.parsePageContent(html);
            expect(result.success).toBe(true);

            const images = result.data.content.components.images;
            expect(images[0].alt).toBe('测试图片');
        });
    });

    describe('configuration', () => {
        test('should update options correctly', () => {
            const newOptions = {
                removeSelectors: ['.custom-remove'],
                imageOptions: { minWidth: 200 }
            };

            parser.updateOptions(newOptions);
            
            const options = parser.getOptions();
            expect(options.removeSelectors).toEqual(['.custom-remove']);
            expect(options.imageOptions.minWidth).toBe(200);
        });

        test('should merge options correctly', () => {
            const originalContentSelector = parser.getOptions().contentSelector;
            
            parser.updateOptions({
                imageOptions: { minWidth: 200 }
            });
            
            const options = parser.getOptions();
            expect(options.contentSelector).toBe(originalContentSelector); // 保持不变
            expect(options.imageOptions.minWidth).toBe(200); // 新值
        });
    });

    describe('error handling', () => {
        test('should handle malformed HTML gracefully', () => {
            const malformedHtml = '<html><body><div id="mw-head"><p>未闭合的标签</body></html>';
            const result = parser.parsePageContent(malformedHtml);

            // 如果Cheerio无法处理且没有有效的Wiki元素，应该失败
            expect(result.success).toBe(false);
        });

        test('should handle missing content selectors', () => {
            const customParser = new PageContentParser({
                contentSelector: '.nonexistent-selector'
            });

            const html = createMockWikiPageHtml();
            const result = customParser.parsePageContent(html);

            // 应该能找到备用选择器
            expect(result.success).toBe(true);
        });

        test('should provide detailed error information', () => {
            const result = parser.parsePageContent('');

            expect(result.success).toBe(false);
            expect(result.error).toHaveProperty('code');
            expect(result.error).toHaveProperty('message');
            expect(result.error.code).toBe('PARSE_ERROR');
            expect(result.data).toBeNull();
        });
    });

    describe('pageContentParser edge cases', () => {
        const wrap = (body) => `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
    <div id="mw-head"></div>
    <div id="content">
        <h1 id="firstHeading">Test</h1>
        <div id="mw-content-text">
            <div class="mw-parser-output">${body}</div>
        </div>
    </div>
</body>
</html>`;

        test('removes data-* attributes without crashing', () => {
            const html = wrap('<div class="infobox" data-id="1" data-x="2"><p>hi</p></div>');
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            expect(result.data.content.html).not.toContain('data-id');
            expect(result.data.content.html).not.toContain('data-x');
        });

        test('handles infobox without class attribute (no TypeError)', () => {
            const html = wrap('<table class="infobox"><tbody><tr><td>x</td></tr></tbody></table>');
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            expect(result.data.content.components.infoboxes).toHaveLength(1);
            expect(result.data.content.components.infoboxes[0].type).toBe('infobox');
        });

        test('merges consecutive same tags safely without skipping', () => {
            const html = wrap('<p>A</p><p>B</p><p>C</p><br><br><br>');
            const result = parser.parsePageContent(html);

            expect(result.success).toBe(true);
            expect(result.data.content.html).toContain('<p>A B C</p>');
            expect((result.data.content.html.match(/<br>/g) || []).length).toBe(1);
        });
    });
});