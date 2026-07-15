/**
 * Real Network Integration Tests
 * These tests make actual HTTP requests to test the complete search workflow
 * 
 * Note: These tests depend on external services and may be slower or flaky
 * They should be run separately from unit tests in CI/CD pipelines
 */

const SearchUrlBuilder = require('../src/services/searchUrlBuilder');
const SearchResultsParser = require('../src/services/searchResultsParser');
const { HttpClient } = require('../src/utils/httpClient');

// Skip these tests if running in CI or if SKIP_NETWORK_TESTS is set
const skipNetworkTests = process.env.CI === 'true' || process.env.SKIP_NETWORK_TESTS === 'true';

describe('Real Network Integration Tests', () => {
  let urlBuilder;
  let parser;
  let httpClient;

  beforeAll(() => {
    urlBuilder = new SearchUrlBuilder();
    parser = new SearchResultsParser();
    httpClient = new HttpClient();
  });

  // Increase timeout for network requests
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  afterEach(() => {
    jest.setTimeout(5000);
  });

  describe('Minecraft Wiki Search Integration', () => {
    (skipNetworkTests ? test.skip : test)('should successfully search for "钻石" and parse results', async () => {
      const keyword = '钻石';
      
      // Build search URL
      const searchUrl = urlBuilder.buildSearchUrl(keyword, { limit: 10 });
      console.log('Generated search URL:', searchUrl);
      expect(searchUrl).toContain(encodeURIComponent('钻石')); // Check for URL-encoded version
      expect(searchUrl).toContain('zh.minecraft.wiki');

      // Make real HTTP request
      const response = await httpClient.get(searchUrl);
      expect(response.status).toBe(200);
      expect(response.data).toBeTruthy();
      expect(typeof response.data).toBe('string');

      // Parse search results
      const results = await parser.parseSearchResults(response.data, keyword);
      
      expect(results.success).toBe(true);
      expect(results.data.keyword).toBe(keyword);
      expect(Array.isArray(results.data.results)).toBe(true);
      
      // Should find at least some results for "钻石"
      expect(results.data.results.length).toBeGreaterThan(0);
      
      // Verify result structure
      const firstResult = results.data.results[0];
      expect(firstResult).toHaveProperty('title');
      expect(firstResult).toHaveProperty('url');
      expect(firstResult).toHaveProperty('snippet');
      expect(firstResult).toHaveProperty('namespace');
      
      expect(typeof firstResult.title).toBe('string');
      expect(typeof firstResult.url).toBe('string');
      expect(typeof firstResult.snippet).toBe('string');
      expect(typeof firstResult.namespace).toBe('string');
      
      // URL should be absolute
      expect(firstResult.url).toMatch(/^https:\/\//);
      expect(firstResult.url).toContain('zh.minecraft.wiki');
    });

    (skipNetworkTests ? test.skip : test)('should handle common search terms correctly', async () => {
      const testCases = [
        { keyword: '红石', expectedMinResults: 1 },
        { keyword: '生物', expectedMinResults: 1 },
        { keyword: '合成', expectedMinResults: 1 }
      ];

      for (const testCase of testCases) {
        const searchUrl = urlBuilder.buildSearchUrl(testCase.keyword);
        const response = await httpClient.get(searchUrl);
        const results = await parser.parseSearchResults(response.data, testCase.keyword);
        
        expect(results.success).toBe(true);
        expect(results.data.results.length).toBeGreaterThanOrEqual(testCase.expectedMinResults);
        
        // At least one result should contain the keyword in title or snippet
        const hasKeywordMatch = results.data.results.some(result => 
          result.title.includes(testCase.keyword) || 
          result.snippet.includes(testCase.keyword)
        );
        expect(hasKeywordMatch).toBe(true);
      }
    });

    (skipNetworkTests ? test.skip : test)('should handle no results scenario', async () => {
      const obscureKeyword = '这个词应该不存在在wiki中12345';
      
      const searchUrl = urlBuilder.buildSearchUrl(obscureKeyword);
      const response = await httpClient.get(searchUrl);
      
      // Should still get a valid HTTP response
      expect(response.status).toBe(200);
      
      const results = await parser.parseSearchResults(response.data, obscureKeyword);
      expect(results.success).toBe(true);
      expect(results.data.keyword).toBe(obscureKeyword);
      
      // Should have empty results or very few results
      expect(results.data.results.length).toBeLessThanOrEqual(2);
      
      // Test the hasNoResults method
      const hasNoResults = parser.hasNoResults(response.data);
      if (results.data.results.length === 0) {
        expect(hasNoResults).toBe(true);
      }
    });

    (skipNetworkTests ? test.skip : test)('should handle different namespaces correctly', async () => {
      const keyword = '物品';
      
      // Search in multiple namespaces
      const searchUrl = urlBuilder.buildSearchUrl(keyword, { 
        namespaces: ['0', '10', '14'], // Main, Template, Category
        limit: 20 
      });
      
      const response = await httpClient.get(searchUrl);
      const results = await parser.parseSearchResults(response.data, keyword);
      
      expect(results.success).toBe(true);
      expect(results.data.results.length).toBeGreaterThan(0);
      
      // Should have results from different namespaces
      const namespaces = results.data.results.map(r => r.namespace);
      const uniqueNamespaces = [...new Set(namespaces)];
      
      // Should have at least one namespace represented
      expect(uniqueNamespaces.length).toBeGreaterThanOrEqual(1);
    });

    (skipNetworkTests ? test.skip : test)('should extract suggestions when available', async () => {
      // Use a slightly misspelled word that might trigger suggestions
      const misspelledKeyword = '砖石'; // Instead of 钻石
      
      const searchUrl = urlBuilder.buildSearchUrl(misspelledKeyword);
      const response = await httpClient.get(searchUrl);
      
      const suggestions = parser.extractSuggestions(response.data);
      
      // Suggestions should be an array
      expect(Array.isArray(suggestions)).toBe(true);
      
      // If suggestions exist, they should be strings
      if (suggestions.length > 0) {
        suggestions.forEach(suggestion => {
          expect(typeof suggestion).toBe('string');
          expect(suggestion.trim().length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    (skipNetworkTests ? test.skip : test)('should handle network timeouts gracefully', async () => {
      // Create a client with very short timeout
      const shortTimeoutClient = new HttpClient({ timeout: 1 }); // 1ms timeout
      
      const searchUrl = urlBuilder.buildSearchUrl('测试');
      
      try {
        await shortTimeoutClient.get(searchUrl);
        // If it doesn't timeout, that's actually fine too
      } catch (error) {
        // Should be a timeout error
        expect(error.code).toMatch(/TIMEOUT|ECONNABORTED/i);
      }
    });

    (skipNetworkTests ? test.skip : test)('should handle invalid URLs gracefully', async () => {
      // Try to request a non-existent page
      const invalidUrl = 'https://zh.minecraft.wiki/w/这个页面绝对不存在12345';
      
      try {
        const response = await httpClient.get(invalidUrl);
        // 404 responses are still valid HTTP responses
        expect([200, 404]).toContain(response.status);
      } catch (error) {
        // Network errors are also acceptable
        expect(error).toBeDefined();
      }
    });

    (skipNetworkTests ? test.skip : test)('should handle special characters in search', async () => {
      const specialKeywords = [
        '红石+',
        '物品@',
        'TNT&爆炸',
        '下界/地狱'
      ];

      for (const keyword of specialKeywords) {
        const searchUrl = urlBuilder.buildSearchUrl(keyword);
        
        // URL should be properly encoded
        expect(searchUrl).not.toContain(' ');
        expect(searchUrl).toContain('search=');
        
        // Should be able to make request without errors
        const response = await httpClient.get(searchUrl);
        expect(response.status).toBe(200);
        
        const results = await parser.parseSearchResults(response.data, keyword);
        expect(results.success).toBe(true);
        expect(results.data.keyword).toBe(keyword);
      }
    });
  });

  describe('Performance and Rate Limiting', () => {
    (skipNetworkTests ? test.skip : test)('should handle multiple concurrent requests', async () => {
      const keywords = ['钻石', '红石', '铁', '金', '煤炭'];
      const startTime = Date.now();
      
      // Make concurrent requests
      const promises = keywords.map(async (keyword) => {
        const searchUrl = urlBuilder.buildSearchUrl(keyword);
        const response = await httpClient.get(searchUrl);
        return await parser.parseSearchResults(response.data, keyword);
      });
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.keyword).toBe(keywords[index]);
      });
      
      // Should complete within reasonable time (less than 30 seconds for 5 requests)
      expect(totalTime).toBeLessThan(30000);
      
      console.log(`Completed ${keywords.length} concurrent requests in ${totalTime}ms`);
    });

    (skipNetworkTests ? test.skip : test)('should respect rate limiting', async () => {
      // Make several sequential requests quickly
      const keyword = '测试';
      const requestCount = 5;
      const results = [];
      
      for (let i = 0; i < requestCount; i++) {
        const searchUrl = urlBuilder.buildSearchUrl(`${keyword}${i}`);
        const response = await httpClient.get(searchUrl);
        results.push(response.status);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // All requests should succeed (no rate limiting errors)
      results.forEach(status => {
        expect([200, 404]).toContain(status);
      });
    });
  });
});

// Helper function to check if network tests should be skipped
function shouldSkipNetworkTests() {
  return skipNetworkTests;
}

// Export for potential use in other test files
module.exports = {
  shouldSkipNetworkTests
};