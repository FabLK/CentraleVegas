/**
 * User conversion helpers for transforming different user types to AppUser
 */

/**
 * AppUser interface required by GroupsManager component
 */
export interface AppUser {
  id: string;
  username: string;
  [key: string]: unknown;
}

/**
 * Base user interface with minimum required properties
 */
export interface BaseUser {
  id: string;
  username?: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * Transforms any user object to AppUser format
 * @param user User object that has at least id property
 * @returns AppUser object or null if input is null
 */
export function transformToAppUser(user: BaseUser | null): AppUser | null {
  if (!user) return null;
  
  return {
    ...user, // Keep any additional properties
    id: user.id,
    username: user.username || user.email || user.id,
  };
} 