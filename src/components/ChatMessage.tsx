import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const ChatMessage = memo(({ role, content, timestamp }: ChatMessageProps) => {
  const isUser = role === "user";

  let displayContent = content;
  if (role === "assistant") {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && typeof parsed.output === "string") {
        displayContent = parsed.output;
      }
    } catch (e) {
      // Not a valid JSON, so we'll just display the content as is
    }
  }

  return (
    <div className={cn("flex gap-3 py-4", isUser ? "justify-end" : "justify-start")}> 
      {!isUser && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}> 
        <Card className={cn(
          "max-w-[80%] px-0 py-0 shadow-sm border-0 bg-transparent",
          isUser 
            ? "bg-chat-bubble-user text-chat-bubble-user-foreground" 
            : "bg-transparent text-chat-bubble-assistant-foreground"
        )}>
          <div className={
            isUser
              ? "m-0 whitespace-pre-wrap px-4 py-3 rounded-lg bg-primary text-primary-foreground"
              : "overflow-x-auto bg-white dark:bg-zinc-900 px-6 py-5 rounded-lg shadow border border-border max-h-[500px]"
          }>
            {isUser ? (
              <p>{displayContent}</p>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props) {
                    const { children, className, node, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || "");
                    const inline = !match;
                    return !inline ? (
                      <SyntaxHighlighter
                        style={oneLight}
                        language={match?.[1] ?? ""}
                        PreTag="div"
                        className="rounded-md"
                        {...rest}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...rest}>
                        {children}
                      </code>
                    );
                  },
                  h1: ({ children }) => <h1 className="text-lg font-semibold mt-4 mb-2 text-red-400">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2 text-red-400">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-red-400">{children}</h3>,
                  p: ({ children }) => <p className="mb-2 last:mb-0 text-black dark:text-white">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-border pl-4 italic my-2">{children}</blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full border border-border">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border px-2 py-1 bg-muted font-semibold text-left">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-2 py-1">{children}</td>
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>
            )}
          </div>
        </Card>
        <span className="text-xs text-muted-foreground px-1">
          {new Date(timestamp).toLocaleTimeString([], { 
            hour: "2-digit", 
            minute: "2-digit" 
          })}
        </span>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
});

ChatMessage.displayName = "ChatMessage";

export default ChatMessage;