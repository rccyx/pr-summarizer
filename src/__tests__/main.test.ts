import { readFileSync } from 'fs';
import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';

// Mock external dependencies
jest.mock('fs');
jest.mock('@actions/core');
jest.mock('@octokit/rest');
jest.mock('openai');

// Import the functions to test
import {
  getPRDetails,
  createSystemPrompt,
  createReviewPrompt,
  getAIResponse,
  analyzeCode,
} from '../main';

describe('PR Review Action Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock values
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'GITHUB_TOKEN':
          return 'mock-token';
        case 'OPENAI_API_KEY':
          return 'mock-api-key';
        case 'OPENAI_API_MODEL':
          return 'gpt-4-turbo-preview';
        default:
          return '';
      }
    });
  });

  describe('getPRDetails', () => {
    it('should fetch PR details successfully', async () => {
      // Mock GitHub event path data
      const mockEventData = {
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo'
        },
        number: 123
      };

      (readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockEventData));

      // Mock Octokit responses
      const mockPRResponse = {
        data: {
          title: 'Test PR',
          body: 'Test Description'
        }
      };

      const mockCommitsResponse = {
        data: [
          {
            sha: 'abc123',
            commit: { message: 'Test commit' }
          }
        ]
      };

      (Octokit as jest.Mock).mockImplementation(() => ({
        pulls: {
          get: jest.fn().mockResolvedValue(mockPRResponse),
          listCommits: jest.fn().mockResolvedValue(mockCommitsResponse)
        }
      }));

      const result = await getPRDetails();

      expect(result).toEqual({
        owner: 'testowner',
        repo: 'testrepo',
        pull_number: 123,
        title: 'Test PR',
        description: 'Test Description',
        commits: [{ sha: 'abc123', message: 'Test commit' }]
      });
    });

    it('should handle missing PR details gracefully', async () => {
      const mockEventData = {
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo'
        },
        number: 123
      };

      (readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockEventData));

      // Mock PR response with missing data
      const mockPRResponse = {
        data: {}
      };

      const mockCommitsResponse = {
        data: []
      };

      (Octokit as jest.Mock).mockImplementation(() => ({
        pulls: {
          get: jest.fn().mockResolvedValue(mockPRResponse),
          listCommits: jest.fn().mockResolvedValue(mockCommitsResponse)
        }
      }));

      const result = await getPRDetails();

      expect(result.title).toBe('');
      expect(result.description).toBe('');
      expect(result.commits).toEqual([]);
    });
  });

  describe('getAIResponse', () => {
    it('should process AI response successfully', async () => {
      const mockAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                reviews: [
                  {
                    lineNumber: 42,
                    reviewComment: 'Test review',
                    severity: 'high',
                    category: 'security'
                  }
                ]
              })
            }
          }
        ]
      };

      (OpenAI as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockAIResponse)
          }
        }
      }));

      const result = await getAIResponse('Test prompt');

      expect(result).toEqual([
        {
          lineNumber: 42,
          reviewComment: 'Test review',
          severity: 'high',
          category: 'security'
        }
      ]);
    });

    it('should handle AI API errors gracefully', async () => {
      (OpenAI as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      }));

      const result = await getAIResponse('Test prompt');

      expect(result).toBeNull();
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('API Error'));
    });
  });

  describe('analyzeCode', () => {
    it('should analyze code and generate comments', async () => {
      const mockFile = {
        to: 'test.ts',
        chunks: [
          {
            content: 'test content',
            changes: [
              { ln: 1, content: 'test change' }
            ]
          }
        ]
      };

      const mockPRDetails = {
        owner: 'testowner',
        repo: 'testrepo',
        pull_number: 123,
        title: 'Test PR',
        description: 'Test Description',
        commits: []
      };

      // Mock AI response
      const mockAIResponse = [
        {
          lineNumber: 1,
          reviewComment: 'Test review',
          severity: 'high',
          category: 'security'
        }
      ];

      // Mock getAIResponse function
      (OpenAI as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: JSON.stringify({ reviews: mockAIResponse })
                  }
                }
              ]
            })
          }
        }
      }));

      const result = await analyzeCode([mockFile as any], mockPRDetails);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        body: expect.stringContaining('Test review'),
        path: 'test.ts',
        line: 1
      });
    });
  });
}); 