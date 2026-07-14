'use client'

import { PageHeader } from '@/components/shared/design-system'

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Lazy-load react-markdown — it's ~40KB and only needed when AI responses are rendered
const ReactMarkdown = lazy(() => import('react-markdown').then(m => ({ default: m.default })))

import {
  Bot,
  Send,
  Trash2,
  Loader2,
  Sparkles,
  User,
  AlertCircle,
  RotateCcw,
  MessageSquare,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'

// ============================================
// Types
// ============================================
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  error?: boolean
}

// ============================================
// Suggested Questions
// ============================================
const suggestedQuestions = [
  'How much stock do I have?',
  'What sold today?',
  'What products are low in stock?',
  'Who owes me money?',
  'What was my profit this month?',
  'What are my best sellers?',
]

// ============================================
// AI Business Assistant Page
// ============================================
export function AIAssistantPage() {
  const { currentOrg } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const MAX_CHARS = 500

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages, isLoading])

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substring(2, 9)

  // Send message
  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || !currentOrg || isLoading) return

    if (!question.trim()) {
      toast.error('Please enter a question')
      return
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const data = await api.askBusinessQuestion(currentOrg.id, question.trim())

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.answer || 'I couldn\'t generate a response. Please try again.',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage = getNetworkErrorMessage(err)

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
        error: true,
      }

      setMessages(prev => [...prev, assistantMessage])
      toast.error('AI request failed', { description: errorMessage })
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [currentOrg, isLoading])

  // Handle send button click
  const handleSend = useCallback(() => {
    sendMessage(inputValue)
  }, [inputValue, sendMessage])

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // Retry failed message
  const handleRetry = useCallback((messageIndex: number) => {
    // Find the user message that preceded the failed assistant message
    if (messageIndex > 0 && messages[messageIndex].error) {
      const userMsg = messages[messageIndex - 1]
      if (userMsg?.role === 'user') {
        // Remove the failed message and resend
        setMessages(prev => prev.filter((_, i) => i !== messageIndex))
        sendMessage(userMsg.content)
      }
    }
  }, [messages, sendMessage])

  // Clear chat
  const handleClear = useCallback(() => {
    setMessages([])
    toast.success('Chat cleared')
  }, [])

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <PageHeader
        className="mb-4"
        icon={<Bot />}
        title="AI Business Assistant"
        subtitle="Ask questions about your inventory, sales, and business data."
        actions={
          messages.length > 0 ? (
            <Button variant="outline" size="sm" onClick={handleClear} className="shrink-0">
              <Trash2 className="size-4 mr-1" />
              Clear Chat
            </Button>
          ) : undefined
        }
      />

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[30.769rem] text-center">
              <div className="size-20 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-6">
                <Sparkles className="size-10 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">How can I help you today?</h2>
              <p className="text-muted-foreground max-w-md mb-8">
                I can answer questions about your inventory, sales, debts, and provide business insights based on your data.
              </p>

              {/* Suggested Questions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    className="flex items-center gap-2 p-3 rounded-lg border text-left text-sm
                      hover:border-primary/60 hover:bg-brand-50/50 dark:hover:bg-brand-900/10
                      transition-colors"
                    onClick={() => sendMessage(question)}
                    disabled={isLoading}
                  >
                    <MessageSquare className="size-4 text-primary shrink-0" />
                    <span>{question}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              <AnimatePresence initial={false}>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* AI avatar */}
                    {message.role === 'assistant' && (
                      <Avatar className="size-8 shrink-0 mt-1">
                        <AvatarFallback className="bg-brand-50 dark:bg-brand-900/20 text-primary">
                          <Bot className="size-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : message.error
                            ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-bl-md'
                            : 'bg-muted rounded-bl-md'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none
                          [&_p]:mb-2 [&_p:last-child]:mb-0
                          [&_ul]:mb-2 [&_ol]:mb-2
                          [&_li]:mb-0.5
                          [&_strong]:text-foreground
                          [&_code]:bg-muted-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                          [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
                          [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-2
                          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1">
                          <Suspense fallback={<span className="text-xs text-muted-foreground">Loading...</span>}>
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </Suspense>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}

                      {/* Timestamp + retry */}
                      <div className={`flex items-center gap-2 mt-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                        <span className={`text-[0.769rem] ${message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {formatTime(message.timestamp)}
                        </span>
                        {message.error && (
                          <button
                            className="flex items-center gap-1 text-[0.769rem] text-red-600 dark:text-red-400 hover:underline"
                            onClick={() => handleRetry(index)}
                          >
                            <RotateCcw className="size-3" />
                            Retry
                          </button>
                        )}
                      </div>
                    </div>

                    {/* User avatar */}
                    {message.role === 'user' && (
                      <Avatar className="size-8 shrink-0 mt-1">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <User className="size-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 justify-start"
                >
                  <Avatar className="size-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-brand-50 dark:bg-brand-900/20 text-primary">
                      <Bot className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-1">
                        <span className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-muted-foreground ml-2">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Suggested questions (shown when there are messages) */}
        {messages.length > 0 && !isLoading && (
          <div className="px-4 pt-3">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap
                    hover:border-primary/60 hover:bg-brand-50/50 dark:hover:bg-brand-900/10
                    transition-colors shrink-0"
                  onClick={() => sendMessage(question)}
                  disabled={isLoading}
                >
                  <Sparkles className="size-3 text-primary" />
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 pt-2">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your business..."
                disabled={isLoading}
                className="pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.769rem] text-muted-foreground">
                {inputValue.length}/{MAX_CHARS}
              </span>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-[0.769rem] text-muted-foreground mt-2 text-center">
            AI may produce inaccurate information. Verify important details with your actual data.
          </p>
        </div>
      </Card>
    </div>
  )
}
