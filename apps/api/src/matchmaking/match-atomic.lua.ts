/**
 * Lua script for atomic matchmaking — runs entirely inside Redis (single-threaded
 * so no race is possible between two concurrent workers).
 *
 * Inputs:
 *   KEYS[1] = country queue: `match:queue:country:<country>`
 *   KEYS[2] = global queue: `match:queue:global`
 *   ARGV[1] = userA id (the user we're trying to match)
 *
 * Output:
 *   nil  — userA is not in any queue (already matched or removed)
 *   nil  — no compatible partner found
 *   { partner, sourceQueue } — partner user id + which queue they came from
 *
 * Algorithm:
 *   1. Check if userA is in country queue (ZSCORE). If not, check global.
 *      If neither, return nil (userA already matched).
 *   2. Find a partner — try country queue first (priority), then global.
 *   3. Atomic ZREM both users from BOTH queues (so they can't be re-matched).
 *   4. Return the partner + which queue they came from.
 *
 * Why atomic: Redis executes Lua scripts single-threaded. Two workers
 * running this script simultaneously — only one will see userA in the queue
 * and match them; the other will see userA is gone and return nil.
 *
 * No double-loss: ZREM in Lua runs atomically with the ZSCORE check above.
 * If two workers both saw userA in the queue (impossible due to single-thread),
 * both would try to match — but ZREM in worker 1 removes A from queue before
 * worker 2 runs. Worker 2 sees A is gone (nil from ZSCORE) and exits.
 */
export const MATCH_ATOMIC_LUA = `
local userA = ARGV[1]

-- Check if userA is in the country queue.
local scoreA = redis.call('ZSCORE', KEYS[1], userA)
local inCountry = scoreA ~= false

if not inCountry then
  scoreA = redis.call('ZSCORE', KEYS[2], userA)
  if not scoreA then
    return nil
  end
end

-- Find partner — country queue first (priority).
local partner = nil
local sourceQueue = nil

if inCountry then
  local users = redis.call('ZRANGE', KEYS[1], 0, -1)
  for _, uid in ipairs(users) do
    if uid ~= userA then
      partner = uid
      sourceQueue = KEYS[1]
      break
    end
  end
end

-- Fallback: global queue.
if not partner then
  local users = redis.call('ZRANGE', KEYS[2], 0, -1)
  for _, uid in ipairs(users) do
    if uid ~= userA then
      partner = uid
      sourceQueue = KEYS[2]
      break
    end
  end
end

if not partner then
  return nil
end

-- Atomic ZREM both from both queues — prevents double-matching.
redis.call('ZREM', KEYS[1], userA, partner)
redis.call('ZREM', KEYS[2], userA, partner)

return { partner, sourceQueue }
`;
