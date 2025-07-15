import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Plus, Trash2, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onSignOut: () => void;
  userEmail?: string;
}

const ChatSidebar = ({ currentChatId, onSelectChat, onNewChat, onSignOut, userEmail }: ChatSidebarProps) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchChats = async () => {
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setChats(data || []);
    } catch (error) {
      console.error("Error fetching chats:", error);
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();

    // Subscribe to chat changes
    const channel = supabase
      .channel("chats-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats" },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId);

      if (error) throw error;

      toast({
        title: "Chat deleted",
        description: "The chat has been removed successfully",
      });

      if (currentChatId === chatId) {
        onNewChat();
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast({
        title: "Error",
        description: "Failed to delete chat",
        variant: "destructive",
      });
    }
  };

  const truncateTitle = (title: string, maxLength: number = 30) => {
    return title.length > maxLength ? title.substring(0, maxLength) + "..." : title;
  };

  return (
    <div className="w-64 h-full bg-muted/20 border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="font-semibold">AI Chatbot</span>
        </div>
        
        <Button 
          onClick={onNewChat} 
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 py-2">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading chats...
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No chats yet. Start a new conversation!
            </div>
          ) : (
            chats.map((chat) => (
              <Card
                key={chat.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/50 group",
                  currentChatId === chat.id && "bg-muted border-primary"
                )}
                onClick={() => onSelectChat(chat.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {truncateTitle(chat.title)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(chat.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 h-auto"
                      onClick={(e) => deleteChat(chat.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-2">
        {userEmail && (
          <div className="text-xs text-muted-foreground truncate px-2">
            {userEmail}
          </div>
        )}
        
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSignOut}
            className="flex-1 justify-start gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;