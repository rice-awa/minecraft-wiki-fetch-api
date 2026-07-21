/**
 * Page Content Parser for Minecraft Wiki
 * 使用Cheerio解析Wiki页面HTML结构，提取和清理页面内容
 */

const cheerio = require('cheerio');
const { logger } = require('../utils/logger');

class PageContentParser {
  constructor(options = {}) {
    // 解析配置
    this.options = {
      // 主要内容选择器
      contentSelector: '#mw-content-text .mw-parser-output',

      // 要移除的元素选择器
      removeSelectors: [
        '.mw-editsection', // 编辑链接
        '.navbox', // 导航框
        '.metadata', // 元数据
        '.stub', // 小作品标记
        '.ambox', // 消息框（部分）
        '.hatnote', // 消歧义link
        '.mw-jump-link', // 跳转链接
        '.printfooter', // 打印页脚
        '.catlinks', // 分类链接
        '#toc + .mw-empty-elt', // 目录后的空元素
        'script', // 脚本
        'style', // 样式
        '.reference .mw-reflink-text', // 参考文献链接文本
        '.mw-cite-backlink', // 引用回链
        '.toctogglespan', // 目录折叠按钮
        '.toctogglelabel', // 目录折叠标签
        '.mw-selflink', // 自链接
        '.searchaux', // 搜索辅助元素
        '.sprite-file', // 精灵文件
        // .pixel-image 在历史表格等 wikitable 上被用作样式修饰，直接 remove 会删掉整张表格。
        // 用 :not(.wikitable) 排除表格，只移除非表格元素上的 pixel-image
        '.pixel-image:not(.wikitable)', // 像素图片容器（排除表格）
        'link[rel="mw-deduplicated-inline-style"]', // 重复样式链接
        '.cite-bracket', // 引用括号
        // 注意：.nowrap 不能直接 remove()，内容包裹在里面的命令名等关键文本也会被删掉，
        // 改为在 _simplifyComplexTags 中用 unwrap 处理。见 _cleanContent 后的 _simplifyComplexTags 调用。
        '.loot-chest-container .wikitable tbody tr:first-child', // 表格标题行（简化战利品表格）
        '.mw-parser-output > .mw-empty-elt', // 空的解析器输出元素
        '.mw-references-wrap', // 参考文献包装器
        '.reflist', // 参考文献列表
        '.citation', // 引用标签
        '.noprint', // 不打印元素
        '.mw-collapsible-toggle', // 折叠切换按钮
        '.wikitable-caption', // 表格标题（某些多余的）
        '.mw-headline-anchor', // 标题锚点
        '.mw-cite-backlink', // 回引链接
        '.mw-reference-text', // 参考文献文本
        '.NavFrame', // 导航框架
        '.NavHead', // 导航头
        '.collapseButton', // 折叠按钮
        'sup.reference', // 上标参考文献
        'span.mw-reflink-text', // 参考链接文本
        '.external.text', // 外部链接文本标记
        '.mw-headline-number', // 标题编号
        '.nomobile', // 非移动端元素
      ],

      // 要保留的特殊元素选择器
      preserveSelectors: [
        '.infobox', // 信息框
        '.thumbinner', // 图片容器
        '.gallery', // 图片画廊
        '#toc', // 目录
        '.wikitable', // Wiki表格
        '.mw-highlight', // 代码高亮
      ],

      // 图片处理
      imageOptions: {
        convertToAbsolute: true, // 转换为绝对URL
        removeSmallImages: true, // 移除小尺寸图片
        minWidth: 50, // 最小宽度
        minHeight: 50, // 最小高度
      },

      // 链接处理
      linkOptions: {
        convertInternalLinks: true, // 转换内部链接
        preserveExternalLinks: true, // 保留外部链接
        baseUrl: 'https://zh.minecraft.wiki',
      },

      ...options,
    };
  }

  /**
   * 解析Wiki页面HTML内容
   * @param {string} html - 原始HTML内容
   * @param {Object} pageInfo - 页面信息
   * @returns {Object} 解析后的页面内容
   */
  parsePageContent(html, pageInfo = {}) {
    try {
      if (!html || typeof html !== 'string') {
        throw new Error('HTML内容必须是非空字符串');
      }

      const $ = cheerio.load(html);

      // 检查是否是有效的Wiki页面
      if (!this._isValidWikiPage($)) {
        throw new Error('不是有效的Wiki页面HTML');
      }

      // 提取页面基本信息
      const basicInfo = this._extractBasicInfo($, pageInfo);

      // 提取主要内容区域
      const $content = this._extractMainContent($);

      if ($content.length === 0) {
        throw new Error('找不到主要内容区域');
      }

      // 清理和处理内容
      this._cleanContent($content);
      this._processImages($content);
      this._processLinks($content);
      this._processTables($content);
      this._simplifyComplexTags($content); // 新增：简化复合标签

      // 提取内容组件
      const components = this._extractContentComponents($content);

      // 生成清理后的HTML
      const cleanHtml = $content.html();

      // 提取纯文本内容
      const textContent = this._extractTextContent($content);

      return {
        success: true,
        data: {
          ...basicInfo,
          content: {
            html: cleanHtml,
            text: textContent,
            components,
          },
          meta: {
            wordCount: this._countWords(textContent),
            imageCount: components.images.length,
            tableCount: components.tables.length,
            sectionCount: components.sections.length,
            processingTime: Date.now(),
          },
        },
      };
    } catch (error) {
      logger.error('页面内容解析失败', { error: error.message, pageInfo });

      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: error.message,
          details: null,
        },
        data: null,
      };
    }
  }

  /**
   * 检查是否是有效的Wiki页面
   * @private
   */
  _isValidWikiPage($) {
    // 检查关键的Wiki页面元素
    const indicators = ['#mw-content-text', '.mw-parser-output', '#firstHeading', '#mw-head'];

    return indicators.some((selector) => $(selector).length > 0);
  }

  /**
   * 提取页面基本信息
   * @private
   */
  _extractBasicInfo($, pageInfo) {
    const title = $('#firstHeading').text().trim() || pageInfo.title || '';
    const subtitle = $('#contentSub').text().trim() || '';

    // 提取页面分类
    const categories = [];
    $('#mw-normal-catlinks a[title]').each((i, el) => {
      const categoryName = $(el).text().trim();
      const categoryUrl = $(el).attr('href');
      if (categoryName) {
        categories.push({
          name: categoryName,
          url: this._normalizeUrl(categoryUrl),
        });
      }
    });

    // 提取页面语言链接
    const languages = [];
    $('#p-lang a').each((i, el) => {
      const langName = $(el).text().trim();
      const langUrl = $(el).attr('href');
      const langCode = $(el).attr('hreflang');
      if (langName && langUrl) {
        languages.push({
          name: langName,
          code: langCode,
          url: langUrl,
        });
      }
    });

    return {
      title,
      subtitle,
      categories,
      languages,
      namespace: pageInfo.namespace || '',
      lastModified: this._extractLastModified($),
    };
  }

  /**
   * 提取主要内容区域
   * @private
   */
  _extractMainContent($) {
    const $content = $(this.options.contentSelector);

    if ($content.length === 0) {
      // 如果找不到标准选择器，尝试备用选择器
      const fallbackSelectors = ['#mw-content-text', '.mw-body-content', '#content .mw-content-ltr'];

      for (const selector of fallbackSelectors) {
        const $fallback = $(selector);
        if ($fallback.length > 0) {
          return $fallback;
        }
      }
    }

    return $content;
  }

  /**
   * 清理内容，移除不需要的元素
   * @private
   */
  _cleanContent($content) {
    // 移除不需要的元素
    this.options.removeSelectors.forEach((selector) => {
      $content.find(selector).remove();
    });

    // 简化清理逻辑，只移除明显的空元素（保留 .minetip，title 中的文字仍需保留）
    $content.find('p:empty, div:empty, span:empty').not('.minetip').remove();

    // 清理连续的空白
    const cleaned = $content.html();
    if (cleaned) {
      $content.html(cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'));
    }
  }

  /**
   * 处理图片
   * @private
   */
  _processImages($content) {
    const { imageOptions } = this.options;
    const $ = cheerio.load($content.html());

    $('img').each((i, el) => {
      const $img = $(el);
      let src = $img.attr('src');

      if (!src) return;

      // 转换为绝对URL
      if (imageOptions.convertToAbsolute && src.startsWith('/')) {
        src = this.options.linkOptions.baseUrl + src;
        $img.attr('src', src);
      }

      // 移除小尺寸图片
      if (imageOptions.removeSmallImages) {
        const width = parseInt($img.attr('width')) || 0;
        const height = parseInt($img.attr('height')) || 0;

        if ((width > 0 && width < imageOptions.minWidth) || (height > 0 && height < imageOptions.minHeight)) {
          $img.closest('.thumb, .thumbinner, figure').remove();
          return;
        }
      }

      // 添加alt属性（如果没有）
      if (!$img.attr('alt')) {
        const caption = $img.closest('.thumbinner').find('.thumbcaption').text().trim();
        if (caption) {
          $img.attr('alt', caption);
        }
      }
    });

    $content.html($.html());
  }

  /**
   * 处理链接
   * @private  
   */
  _processLinks($content) {
    const { linkOptions } = this.options;
    const $ = cheerio.load($content.html());

    $('a[href]').each((i, el) => {
      const $link = $(el);
      let href = $link.attr('href');
      const linkText = $link.text().trim();

      if (!href) return;

      // 移除编辑链接和其他不需要的链接
      if (
        href.includes('action=edit') ||
        href.includes('redlink=1') ||
        href.includes('Special:') ||
        href.includes('File:') ||
        href.includes('Category:') ||
        $link.hasClass('mw-selflink') ||
        $link.hasClass('external') ||
        $link.hasClass('mw-cite-backlink') ||
        $link.hasClass('mw-reflink-text')
      ) {
        $link.replaceWith(linkText);
        return;
      }

      // 移除大部分内部Wiki链接，只保留文本内容
      // 这解决了用户提到的"复合标签，文字都会套一个链接"的问题
      if (href.startsWith('/') || href.startsWith('#')) {
        // 检查是否是重要的内部链接（如目录链接）
        if (href.startsWith('#') && $link.closest('#toc, .toc').length > 0) {
          // 保留目录中的锚点链接
          if (linkOptions.convertInternalLinks) {
            href = linkOptions.baseUrl + href;
            $link.attr('href', href);
          }
        } else {
          // 移除普通的内部链接，只保留文本
          $link.replaceWith(linkText);
        }
        return;
      }

      // 处理外部链接 - 保留真正有用的外部链接
      if (
        linkOptions.preserveExternalLinks &&
        (href.startsWith('http://') || href.startsWith('https://')) &&
        !href.includes('minecraft.wiki') &&
        !href.includes('minecraftwiki.net')
      ) {
        // 保留外部链接
        return;
      }

      // 其他情况下移除链接，保留文本
      $link.replaceWith(linkText);
    });

    // 清理空的链接元素
    $('a:empty').remove();

    $content.html($.html());
  }

  /**
   * 处理表格
   * @private
   */
  _processTables($content) {
    const $ = cheerio.load($content.html());

    $('table').each((i, el) => {
      const $table = $(el);

      // 为表格添加响应式类
      if (!$table.hasClass('wikitable')) {
        $table.addClass('wikitable');
      }

      // 清理表格样式
      $table.removeAttr('style border cellpadding cellspacing');
      $table.find('*').removeAttr('style');
    });

    $content.html($.html());
  }

  /**
   * 简化复合标签结构，移除不必要的嵌套和样式
   * @private
   */
  _simplifyComplexTags($content) {
    const $ = cheerio.load($content.html());

    // 移除不必要的span标签，只保留有意义的内容
    $('span').each((i, el) => {
      const $span = $(el);
      const classList = $span.attr('class') || '';

      // 移除只有样式作用的span标签
      if (
        !classList ||
        classList.includes('nowrap') ||
        classList.includes('mw-') ||
        classList.includes('sprite-') ||
        classList.includes('pixel-')
      ) {
        $span.replaceWith($span.html());
      }
    });

    // 处理 .minetip 工具提示：内部 sprite/file 图标被移除后，元素可能变空，
    // 此时用 title 属性中的文字恢复内容（常用于表格表头图标列）
    $('.minetip').each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const title = $el.attr('title');
      if (!text) {
        if (title) {
          $el.text(title);
        }
      }
    });

    // 简化div结构，移除只有样式作用的div
    $('div').each((i, el) => {
      const $div = $(el);
      const classList = $div.attr('class') || '';

      // 保留重要的div（如infobox, 表格容器等）
      if (!this._isPreservedElement($div) && (!classList || classList.includes('mw-parser-output') === false)) {
        // 如果div只包含文本或简单内容，简化它
        if ($div.children().length <= 1) {
          $div.replaceWith($div.html());
        }
      }
    });

    // 移除空的样式属性
    $('*').each((i, el) => {
      const $el = $(el);
      $el.removeAttr('style');
      const dataAttrs = Object.keys(el.attribs || {}).filter((k) => k.startsWith('data-'));
      dataAttrs.forEach((k) => $el.removeAttr(k));

      // 移除不必要的class属性
      const classList = $el.attr('class');
      if (classList) {
        const cleanClasses = classList
          .split(' ')
          .filter(
            (cls) =>
              cls.includes('infobox') ||
              cls.includes('wikitable') ||
              cls.includes('thumb') ||
              cls.includes('gallery') ||
              cls.includes('toc')
          );

        if (cleanClasses.length > 0) {
          $el.attr('class', cleanClasses.join(' '));
        } else {
          $el.removeAttr('class');
        }
      }
    });

    // 清理连续的空白元素
    $('p:empty, div:empty, span:empty').remove();

    // 合并连续的相同标签。避免使用 `p + p` / `br + br` 相邻兄弟选择器：
    // 前面的 replaceWith($el.html()) 可能会让 Cheerio/domutils 的 sibling 链不一致，
    // css-select 在解析 `br + br` 时会读取到 undefined sibling 并抛出 TypeError。
    this._mergeConsecutiveParagraphsAndBreaks($);

    $content.html($.html());
  }

  /**
   * 合并连续的段落并移除重复换行。
   * 通过父节点的 children 手动遍历，避免依赖 Cheerio 的相邻兄弟选择器。
   * @private
   */
  _mergeConsecutiveParagraphsAndBreaks($) {
    $('body, .mw-parser-output, div, section, article, td, th, li, blockquote').each((i, parent) => {
      const children = [...(parent.children || [])];
      let previousElement = null;

      children.forEach((child) => {
        if (!child || child.type !== 'tag') {
          return;
        }

        const tagName = child.name && child.name.toLowerCase();

        if (tagName === 'p' && previousElement && previousElement.name === 'p') {
          const $previous = $(previousElement);
          const currentHtml = $(child).html();

          if (currentHtml) {
            $previous.append(` ${currentHtml}`);
          }

          $(child).remove();
          return;
        }

        if (tagName === 'br' && previousElement && previousElement.name === 'br') {
          $(child).remove();
          return;
        }

        previousElement = child;
      });
    });
  }

  /**
   * 提取内容组件
   * @private
   */
  _extractContentComponents($content) {
    const components = {
      sections: [],
      images: [],
      tables: [],
      infoboxes: [],
      toc: null,
    };

    const $ = cheerio.load($content.html());

    // 提取章节
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const $heading = $(el);
      const level = parseInt($heading.prop('tagName').substring(1));
      const text = $heading.text().trim();
      const id = $heading.attr('id') || '';

      if (text) {
        components.sections.push({
          level,
          text,
          id,
          anchor: id ? `#${id}` : '',
        });
      }
    });

    // 提取图片
    $('img').each((i, el) => {
      const $img = $(el);
      const src = $img.attr('src');
      const alt = $img.attr('alt') || '';
      const caption = $img.closest('.thumbinner').find('.thumbcaption').text().trim();

      if (src) {
        components.images.push({
          src,
          alt,
          caption,
          width: $img.attr('width'),
          height: $img.attr('height'),
        });
      }
    });

    // 提取表格
    $('table').each((i, el) => {
      const $table = $(el);
      const caption = $table.find('caption').text().trim();
      const rowCount = $table.find('tr').length;
      const colCount = $table.find('tr').first().find('th, td').length;

      components.tables.push({
        caption,
        rowCount,
        colCount,
        hasHeader: $table.find('th').length > 0,
      });
    });

    // 提取信息框
    $('.infobox').each((i, el) => {
      const $infobox = $(el);
      const title = $infobox.find('.infobox-title, .fn').first().text().trim();
      const cls = $infobox.attr('class') || '';
      const type = cls.split(' ').find((c) => c.includes('infobox')) || 'infobox';

      components.infoboxes.push({
        title,
        type,
        hasImage: $infobox.find('img').length > 0,
      });
    });

    // 提取目录
    const $toc = $('#toc, .toc');
    if ($toc.length > 0) {
      const tocItems = [];
      $toc.find('a').each((i, el) => {
        const $link = $(el);
        const text = $link.text().trim();
        const href = $link.attr('href');
        if (text && href) {
          tocItems.push({ text, href });
        }
      });
      components.toc = { items: tocItems };
    }

    return components;
  }

  /**
   * 提取纯文本内容
   * @private
   */
  _extractTextContent($content) {
    // 创建内容副本用于文本提取
    const $ = cheerio.load($content.html());

    // 移除不需要的元素
    $('script, style, .infobox, #toc, .navbox').remove();

    // 获取纯文本并清理
    let text = $.text();

    // 清理多余的空白
    text = text.replace(/\s+/g, ' ').trim();

    // 移除重复的换行
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');

    return text;
  }

  /**
   * 检查是否是需要保留的元素
   * @private
   */
  _isPreservedElement($el) {
    return this.options.preserveSelectors.some((selector) => {
      try {
        return $el.is && $el.is(selector);
      } catch {
        return false;
      }
    });
  }

  /**
   * 规范化URL
   * @private
   */
  _normalizeUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return this.options.linkOptions.baseUrl + url;
    return url;
  }

  /**
   * 提取最后修改时间
   * @private
   */
  _extractLastModified($) {
    const lastModText = $('#footer-info-lastmod').text();
    if (lastModText) {
      const match = lastModText.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
      return match ? match[1] : null;
    }
    return null;
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
   * 更新解析器配置
   * @param {Object} newOptions - 新的配置选项
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * 获取当前配置
   * @returns {Object} 当前配置
   */
  getOptions() {
    return { ...this.options };
  }
}

module.exports = PageContentParser;
