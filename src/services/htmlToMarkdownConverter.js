/**
 * HTML to Markdown Converter for Minecraft Wiki
 * 将Wiki页面HTML内容转换为Markdown格式，专门处理Wiki特有元素
 */

const TurndownService = require('turndown');
const { logger } = require('../utils/logger');

class HtmlToMarkdownConverter {
    constructor(options = {}) {
        // 转换配置
        this.options = {
            // 基础URL，用于处理相对链接
            baseUrl: 'https://zh.minecraft.wiki',
            
            // Turndown选项
            turndownOptions: {
                headingStyle: 'atx',           // 使用 # 风格的标题
                hr: '---',                     // 分隔线样式
                bulletListMarker: '-',         // 无序列表标记
                codeBlockStyle: 'fenced',      // 使用围栏式代码块
                fence: '```',                  // 代码块围栏
                emDelimiter: '*',              // 斜体分隔符
                strongDelimiter: '**',         // 粗体分隔符
                linkStyle: 'inlined',          // 内联链接样式
                linkReferenceStyle: 'full',    // 引用链接样式
                preformattedCode: false,       // 不保留预格式化代码
                blankReplacement: function(content, node) {
                    // 替换空白节点
                    return node.isBlock ? '\n\n' : '';
                },
                keepReplacement: function(content, node) {
                    // 保留某些节点
                    return node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML;
                },
                defaultReplacement: function(content, node) {
                    // 默认替换
                    return node.isBlock ? '\n\n' + content + '\n\n' : content;
                }
            },

            // Wiki特有元素处理
            wikiElements: {
                preserveInfoboxes: true,       // 保留信息框
                convertTables: true,           // 转换表格
                handleImages: true,            // 处理图片
                processLinks: true,            // 处理链接
                preserveToc: true,             // 保留目录
                convertTemplates: false       // 转换模板（通常移除）
            },

            // 图片处理选项
            imageOptions: {
                preserveSize: true,            // 保留图片尺寸
                addCaptions: true,             // 添加图片说明
                convertToAbsolute: true        // 转换为绝对URL
            },

            // 链接处理选项
            linkOptions: {
                convertInternalLinks: true,    // 转换内部链接
                preserveExternalLinks: true,   // 保留外部链接
                removeEditLinks: true          // 移除编辑链接
            },

            ...options
        };

        this.initializeTurndown();
    }

    /**
     * 初始化Turndown转换器
     * @private
     */
    initializeTurndown() {
        this.turndownService = new TurndownService(this.options.turndownOptions);
        
        // 添加自定义规则
        this.addCustomRules();
    }

    /**
     * 将HTML转换为Markdown
     * @param {string} html - 要转换的HTML内容
     * @param {Object} context - 转换上下文信息
     * @returns {Object} 转换结果
     */
    convertToMarkdown(html, context = {}) {
        try {
            if (!html || typeof html !== 'string') {
                throw new Error('HTML内容必须是非空字符串');
            }

            // 预处理HTML
            const processedHtml = this._preprocessHtml(html, context);
            
            // 执行转换
            let markdown = this.turndownService.turndown(processedHtml);
            
            // 后处理Markdown
            markdown = this._postprocessMarkdown(markdown, context);

            return {
                success: true,
                data: {
                    markdown,
                    stats: this._generateStats(html, markdown),
                    context: context
                }
            };

        } catch (error) {
            logger.error('HTML到Markdown转换失败', { 
                error: error.message, 
                context 
            });
            
            return {
                success: false,
                error: {
                    code: 'CONVERSION_ERROR',
                    message: error.message,
                    details: null
                },
                data: null
            };
        }
    }

    /**
     * 添加自定义转换规则
     * @private
     */
    addCustomRules() {
        // 信息框处理规则
        if (this.options.wikiElements.preserveInfoboxes) {
            this.turndownService.addRule('infobox', {
                filter: function(node) {
                    return node.nodeName === 'DIV' && 
                           (node.classList.contains('infobox') || 
                            node.classList.contains('infobox-wrapper'));
                },
                replacement: (content, node) => {
                    const title = this._extractInfoboxTitle.call(this, node);
                    const info = this._extractInfoboxContent.call(this, node);
                    
                    let result = '\n\n## ' + (title || '信息') + '\n\n';
                    
                    if (info.length > 0) {
                        info.forEach(item => {
                            if (item.label && item.value) {
                                result += `**${item.label}**: ${item.value}\n\n`;
                            }
                        });
                    } else {
                        // 如果没有提取到结构化信息，保留原始内容
                        result += content;
                    }
                    
                    return result;
                }
            });
        }

        // 表格处理规则
        if (this.options.wikiElements.convertTables) {
            this.turndownService.addRule('wikitable', {
                filter: ['table'],
                replacement: (content, node) => {
                    return this._convertTable.call(this, node);
                }
            });
        }

        // 图片处理规则
        if (this.options.wikiElements.handleImages) {
            this.turndownService.addRule('wikiimage', {
                filter: function(node) {
                    return node.nodeName === 'DIV' && 
                           (node.className && (
                               node.className.includes('thumbinner') || 
                               node.className.includes('thumb')
                           ));
                },
                replacement: (content, node) => {
                    return this._convertImageBlock.call(this, node);
                }
            });

            // 单独的图片元素
            this.turndownService.addRule('image', {
                filter: ['img'],
                replacement: (content, node) => {
                    return this._convertImage.call(this, node);
                }
            });
        }

        // 目录处理规则
        if (this.options.wikiElements.preserveToc) {
            this.turndownService.addRule('toc', {
                filter: function(node) {
                    return node.nodeName === 'DIV' && 
                           (node.id === 'toc' || 
                            (node.className && node.className.includes('toc')));
                },
                replacement: (content, node) => {
                    return this._convertToc.call(this, node);
                }
            });
        }

        // 模板处理规则（通常移除）
        this.turndownService.addRule('template', {
            filter: function(node) {
                return node.nodeName === 'DIV' && 
                       (node.className && (
                           node.className.includes('template') ||
                           node.className.includes('navbox') ||
                           node.className.includes('ambox')
                       ));
            },
            replacement: () => ''  // 完全移除模板内容
        });

        // 链接处理规则
        if (this.options.linkOptions.removeEditLinks) {
            this.turndownService.addRule('editlinks', {
                filter: function(node) {
                    return node.nodeName === 'SPAN' && 
                           (node.className && node.className.includes('mw-editsection'));
                },
                replacement: () => ''  // 移除编辑链接
            });
        }

        // 引用和脚注处理
        this.turndownService.addRule('references', {
            filter: function(node) {
                return node.nodeName === 'SUP' && 
                       (node.className && (
                           node.className.includes('reference') ||
                           node.className.includes('cite')
                       ));
            },
            replacement: (content, node) => {
                const refText = node.textContent.trim();
                return refText ? `[^${refText}]` : '';
            }
        });
    }

    /**
     * 预处理HTML内容
     * @private
     */
    _preprocessHtml(html, context) {
        let processed = html;

        // 转换相对URL为绝对URL
        if (this.options.linkOptions.convertInternalLinks) {
            processed = processed.replace(
                /href="\/w\//g, 
                `href="${this.options.baseUrl}/w/`
            );
            processed = processed.replace(
                /src="\/images\//g, 
                `src="${this.options.baseUrl}/images/`
            );
        }

        // 清理不需要的属性
        processed = processed.replace(/\s+class="[^"]*"/g, '');
        processed = processed.replace(/\s+style="[^"]*"/g, '');
        processed = processed.replace(/\s+data-[^=]*="[^"]*"/g, '');

        return processed;
    }

    /**
     * 后处理Markdown内容
     * @private
     */
    _postprocessMarkdown(markdown, context) {
        let processed = markdown;

        // 清理多余的空行
        processed = processed.replace(/\n{3,}/g, '\n\n');
        
        // 修复表格格式
        processed = this._fixTableFormatting(processed);
        
        // 修复链接格式
        processed = this._fixLinkFormatting(processed);
        
        // 修复中文标点周围的空格
        processed = this._fixChinesePunctuation(processed);

        return processed.trim();
    }

    /**
     * 提取信息框标题
     * @private
     */
    _extractInfoboxTitle(node) {
        const titleSelectors = [
            '.infobox-title',
            '.fn',
            'caption',
            'th:first-child'
        ];

        for (const selector of titleSelectors) {
            const titleElement = node.querySelector(selector);
            if (titleElement) {
                return titleElement.textContent.trim();
            }
        }

        return '';
    }

    /**
     * 提取信息框内容
     * @private
     */
    _extractInfoboxContent(node) {
        const content = [];
        
        // 尝试多种方式提取信息框内容
        const rows = node.querySelectorAll('tr');
        
        if (rows.length > 0) {
            // 表格式信息框
            rows.forEach(row => {
                const cells = row.querySelectorAll('th, td');
                if (cells.length >= 2) {
                    const label = cells[0].textContent.trim();
                    const value = cells[1].textContent.trim();
                    if (label && value) {
                        content.push({ label, value });
                    }
                }
            });
        } else {
            // 非表格式信息框，尝试提取关键信息
            const keyValuePairs = node.querySelectorAll('dt, dd');
            for (let i = 0; i < keyValuePairs.length - 1; i += 2) {
                const label = keyValuePairs[i]?.textContent?.trim();
                const value = keyValuePairs[i + 1]?.textContent?.trim();
                if (label && value) {
                    content.push({ label, value });
                }
            }
        }

        return content;
    }

    /**
     * 转换表格
     * @private
     */
    _convertTable(tableNode) {
        const rows = Array.from(tableNode.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        let markdown = '\n\n';
        
        // 处理表格标题
        const caption = tableNode.querySelector('caption');
        if (caption) {
            markdown += `**${caption.textContent.trim()}**\n\n`;
        }

        // 处理表格行
        rows.forEach((row, rowIndex) => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            if (cells.length === 0) return;

            // 构建表格行
            const cellContents = cells.map(cell => {
                return cell.textContent.trim().replace(/\|/g, '\\|');
            });

            markdown += `| ${cellContents.join(' | ')} |\n`;

            // 添加表头分隔符
            if (rowIndex === 0 && row.querySelector('th')) {
                const separator = cells.map(() => '---').join(' | ');
                markdown += `| ${separator} |\n`;
            }
        });

        return markdown + '\n';
    }

    /**
     * 转换图片块
     * @private
     */
    _convertImageBlock(node) {
        const img = node.querySelector('img');
        if (!img) return '';

        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt') || '';
        const caption = node.querySelector('.thumbcaption');
        const captionText = caption ? caption.textContent.trim() : '';

        let markdown = '\n\n';
        
        if (this.options.imageOptions.convertToAbsolute && src && src.startsWith('/')) {
            const absoluteSrc = this.options.baseUrl + src;
            markdown += `![${alt}](${absoluteSrc})`;
        } else {
            markdown += `![${alt}](${src || ''})`;
        }

        if (this.options.imageOptions.addCaptions && captionText) {
            markdown += `\n\n*${captionText}*`;
        }

        return markdown + '\n\n';
    }

    /**
     * 转换单个图片
     * @private
     */
    _convertImage(imgNode) {
        const src = imgNode.getAttribute('src');
        const alt = imgNode.getAttribute('alt') || '';

        if (!src) return '';

        if (this.options.imageOptions.convertToAbsolute && src.startsWith('/')) {
            const absoluteSrc = this.options.baseUrl + src;
            return `![${alt}](${absoluteSrc})`;
        }

        return `![${alt}](${src})`;
    }

    /**
     * 转换目录
     * @private
     */
    _convertToc(tocNode) {
        const links = Array.from(tocNode.querySelectorAll('a'));
        if (links.length === 0) return '';

        let markdown = '\n\n## 目录\n\n';
        
        links.forEach(link => {
            const text = link.textContent.trim();
            const href = link.getAttribute('href');
            
            if (text && href) {
                // 提取层级信息
                const level = this._extractTocLevel(link);
                const indent = '  '.repeat(Math.max(0, level - 1));
                
                markdown += `${indent}- [${text}](${href})\n`;
            }
        });

        return markdown + '\n';
    }

    /**
     * 提取目录层级
     * @private
     */
    _extractTocLevel(linkNode) {
        const tocLine = linkNode.closest('li');
        if (!tocLine) return 1;

        // 通过父级li元素的嵌套深度确定层级
        let level = 1;
        let parent = tocLine.parentElement;
        
        while (parent && parent.nodeName === 'UL') {
            level++;
            parent = parent.parentElement?.closest('li')?.parentElement;
        }

        return Math.min(level, 6); // 限制最大层级为6
    }

    /**
     * 修复表格格式
     * @private
     */
    _fixTableFormatting(markdown) {
        // 仅在完整表格块的前后添加空行，避免将连续的表格行拆开。
        return markdown
            .replace(/^([^\n|][^\n]*)\n(\|[^\n]*(?:\n\|[^\n]*)*)/gm, '$1\n\n$2')
            .replace(/^(\|[^\n]*(?:\n\|[^\n]*)*)\n([^\n|])/gm, '$1\n\n$2');
    }

    /**
     * 修复链接格式
     * @private
     */
    _fixLinkFormatting(markdown) {
        // 修复链接中的空格问题
        return markdown.replace(/\[\s+([^\]]+)\s+\]/g, '[$1]');
    }

    /**
     * 修复中文标点
     * @private
     */
    _fixChinesePunctuation(markdown) {
        // 移除中文标点前后的不必要空格
        return markdown.replace(/[ \t]+([，。！？；：])/g, '$1')
                      .replace(/([，。！？；：])[ \t]+/g, '$1');
    }

    /**
     * 生成转换统计信息
     * @private
     */
    _generateStats(originalHtml, convertedMarkdown) {
        return {
            originalLength: originalHtml.length,
            convertedLength: convertedMarkdown.length,
            compressionRatio: (convertedMarkdown.length / originalHtml.length).toFixed(2),
            linesCount: convertedMarkdown.split('\n').length,
            charactersCount: convertedMarkdown.length,
            wordsCount: this._countWords(convertedMarkdown),
            processingTime: Date.now()
        };
    }

    /**
     * 统计词数
     * @private
     */
    _countWords(text) {
        if (!text) return 0;
        
        // 对于中文，按字符计数；对于英文，按单词计数
        const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
        const englishWords = text.match(/[a-zA-Z]+/g) || [];
        
        return chineseChars.length + englishWords.length;
    }

    /**
     * 更新转换器配置
     * @param {Object} newOptions - 新的配置选项
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        this.initializeTurndown(); // 重新初始化转换器
    }

    /**
     * 获取当前配置
     * @returns {Object} 当前配置
     */
    getOptions() {
        return { ...this.options };
    }
}

module.exports = HtmlToMarkdownConverter;
