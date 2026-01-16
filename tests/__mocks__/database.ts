// Mock database pool for testing
import { QueryResult } from 'pg';

const mockPool = {
  connect: jest.fn(),
  query: jest.fn() as jest.Mock<Promise<QueryResult>, any[]>,
  end: jest.fn(),
  on: jest.fn(),
};

export { mockPool };
export const pool = mockPool as any;
