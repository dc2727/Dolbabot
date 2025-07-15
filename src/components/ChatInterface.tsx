import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import ChatSidebar from "./ChatSidebar";
import { Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Chat {
  id: string;
  title: string;
  model: string;
}

interface ChatInterfaceProps {
  user: any;
  onSignOut: () => void;
}

const ChatInterface = ({ user, onSignOut }: ChatInterfaceProps) => {
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewChat = async (firstMessage?: string) => {
    try {
      const title = firstMessage?.slice(0, 50) || "New Chat";
      
      const { data, error } = await supabase
        .from("chats")
        .insert({
          title,
          model: "gpt-4-mini",
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentChat(data);
      setMessages([]);
      return data;
    } catch (error) {
      console.error("Error creating chat:", error);
      toast({
        title: "Error",
        description: "Failed to create new chat",
        variant: "destructive",
      });
      return null;
    }
  };

  const loadChat = async (chatId: string) => {
    setLoading(true);
    try {
      // Load chat details
      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select("*")
        .eq("id", chatId)
        .single();

      if (chatError) throw chatError;

      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      setCurrentChat(chatData);
      setMessages((messagesData || []) as Message[]);
    } catch (error) {
      console.error("Error loading chat:", error);
      toast({
        title: "Error",
        description: "Failed to load chat",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (files: File[], messageId: string) => {
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${messageId}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('chat-files')
        .upload(fileName, file);

      if (error) throw error;

      // Save file record to database
      await supabase.from('files').insert({
        message_id: messageId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: data.path,
      });

      return data.path;
    });

    return Promise.all(uploadPromises);
  };

  const sendMessage = async (content: string, files?: File[]) => {
    if (!content.trim() && (!files || files.length === 0)) return;

    setSendingMessage(true);
    let chat = currentChat;

    try {
      // Create new chat if none exists
      if (!chat) {
        chat = await createNewChat(content);
        if (!chat) return;
      }

      // Add user message to database
      const { data: userMessage, error: userError } = await supabase
        .from("messages")
        .insert({
          chat_id: chat.id,
          role: "user",
          content,
        })
        .select()
        .single();

      if (userError) throw userError;

      // Upload files if any
      if (files && files.length > 0) {
        await uploadFiles(files, userMessage.id);
      }

      // Add user message to UI
      setMessages(prev => [...prev, userMessage as Message]);

      // Prepare request to webhook
      const webhookPayload = {
        message: content,
        model: chat.model,
        chat_id: chat.id,
        user_id: user.id,
        files: files ? files.map(f => ({ name: f.name, type: f.type, size: f.size })) : [],
      };

      // Send to webhook
      const response = await fetch("https://n8n.srv780260.hstgr.cloud/webhook/68bb128c-deb7-42d0-b5ea-bda1aabf4873", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.statusText}`);
      }

      const result = await response.text();

      // Add assistant response to database
      const { data: assistantMessage, error: assistantError } = await supabase
        .from("messages")
        .insert({
          chat_id: chat.id,
          role: "assistant",
          content: result,
        })
        .select()
        .single();

      if (assistantError) throw assistantError;

      // Add assistant message to UI
      setMessages(prev => [...prev, assistantMessage as Message]);

      // Update chat timestamp
      await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chat.id);

    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleNewChat = () => {
    setCurrentChat(null);
    setMessages([]);
  };

  const handleModelChange = async (newModel: string) => {
    if (currentChat) {
      try {
        await supabase
          .from("chats")
          .update({ model: newModel })
          .eq("id", currentChat.id);

        setCurrentChat(prev => prev ? { ...prev, model: newModel } : null);
      } catch (error) {
        console.error("Error updating model:", error);
        toast({
          title: "Error",
          description: "Failed to update model",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <ChatSidebar
        currentChatId={currentChat?.id || null}
        onSelectChat={loadChat}
        onNewChat={handleNewChat}
        onSignOut={onSignOut}
        userEmail={user?.email}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <h2 className="text-2xl font-semibold mb-2">Welcome to AI Chatbot</h2>
                <p>Start a conversation by typing a message below.</p>
                <p className="text-sm mt-2">You can paste images or upload files to share with the AI.</p>
              </div>
            </div>
          ) : (
            <div className="py-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.created_at}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <ChatInput
          onSendMessage={sendMessage}
          disabled={sendingMessage}
          model={currentChat?.model || "gpt-4-mini"}
          onModelChange={handleModelChange}
        />
      </div>
    </div>
  );
};

export default ChatInterface;