type ChatStatsProps = {
  currentRepo: string
  sessionId?: string
  stats?: {
    sessionId?: string
    duration?: number
    usage?: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
}

export const ChatStats = ({ currentRepo, sessionId, stats }: ChatStatsProps) => {
  if (!stats || !(stats.sessionId || stats.duration || stats.usage)) {
    return null
  }

  return (
    <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <span className="text-blue-600 dark:text-blue-400">
              user@{currentRepo || 'loading...'}
            </span>
          </div>

          {stats.sessionId && (
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                />
              </svg>
              <span className="font-mono">{stats.sessionId.slice(0, 8)}</span>
            </div>
          )}

          {stats.duration && (
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{(stats.duration / 1000).toFixed(1)}s</span>
            </div>
          )}

          {stats.usage && (
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">In:</span>
                <span className="font-medium">{stats.usage.input_tokens.toLocaleString()}</span>
              </div>
              <span className="text-gray-400">→</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Out:</span>
                <span className="font-medium">{stats.usage.output_tokens.toLocaleString()}</span>
              </div>
              {stats.usage.cache_creation_input_tokens && (
                <div className="flex items-center gap-1">
                  <span className="text-blue-600 dark:text-blue-400">
                    +{stats.usage.cache_creation_input_tokens.toLocaleString()} cache
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {sessionId && (
          <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Active</span>
          </div>
        )}
      </div>
    </div>
  )
}
