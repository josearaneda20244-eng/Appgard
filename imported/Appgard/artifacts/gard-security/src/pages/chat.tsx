import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  useListMessages,
  useSendMessage,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, Hash } from "lucide-react";

const CHANNELS = [
  { id: "general", name: "General" },
  { id: "operaciones", name: "Operaciones" },
  { id: "emergencias", name: "Emergencias" },
];

export default function Chat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeChannel, setActiveChannel] = useState("general");
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useListMessages(
    { channelId: activeChannel },
    { query: { refetchInterval: 3000 } }
  );

  const sendMessage = useSendMessage();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate(
      { data: { channelId: activeChannel, content: message } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey({ channelId: activeChannel }) });
          setMessage("");
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100svh-57px)] lg:h-full flex flex-col md:flex-row min-w-0 overflow-hidden">
      <div className="md:w-60 md:border-r border-border bg-card/50 p-3 md:p-4 flex-shrink-0">
        <h2 className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 md:mb-3">Canales</h2>
        <div className="flex md:block gap-2 md:space-y-1 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`flex-shrink-0 md:w-full flex items-center gap-2 px-3 py-2 rounded-full md:rounded-md text-sm transition-colors ${activeChannel === ch.id ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground bg-secondary/25 md:bg-transparent hover:bg-secondary/50"}`}
              data-testid={`button-channel-${ch.id}`}
            >
              <Hash size={14} />
              {ch.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="border-y md:border-t-0 border-border px-4 py-3 bg-background/80">
          <div className="flex items-center gap-2">
            <Hash size={18} className="text-muted-foreground" />
            <h2 className="font-semibold" data-testid="text-channel-name">
              {CHANNELS.find((c) => c.id === activeChannel)?.name}
            </h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center px-6">
              <MessageSquare size={40} className="mb-2 opacity-30" />
              <p className="text-sm">No hay mensajes en este canal</p>
            </div>
          )}
          {messages?.map((msg) => {
            const isOwn = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`} data-testid={`message-${msg.id}`}>
                <div className={`max-w-[86%] md:max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${isOwn ? "bg-primary text-primary-foreground" : "bg-secondary/60 border border-border/60"}`}>
                  {!isOwn && (
                    <p className="text-xs font-semibold mb-1 text-muted-foreground">{msg.senderName}</p>
                  )}
                  <p className="text-sm">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border p-3 md:p-4 bg-card/40 safe-bottom">
          <div className="flex items-center gap-2 min-w-0">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              className="flex-1 min-w-0 h-11 bg-background/80"
              data-testid="input-message"
            />
            <Button onClick={handleSend} disabled={!message.trim() || sendMessage.isPending} data-testid="button-send" className="h-11 w-12 flex-shrink-0">
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
