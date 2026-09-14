import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  // Background-task/worktree sessions leave a checkout (with its own
  // package.json + __tests__) nested under .claude/worktrees — without this,
  // Jest's haste map collides on the duplicate package.json and a full run
  // picks up that worktree's tests too, surfacing failures (or successes)
  // that belong to a different, possibly in-progress session's work.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.claude/worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
}

export default createJestConfig(config)
