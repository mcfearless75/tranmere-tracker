export default function ChatRoomLoading() {
  return (
    <div className="flex flex-col h-full p-4 space-y-3 animate-pulse">
      {/* Incoming and outgoing message bubbles */}
      <div className="h-10 w-3/5 bg-gray-200 rounded-2xl" />
      <div className="h-10 w-2/5 bg-gray-100 rounded-2xl self-end" />
      <div className="h-16 w-3/4 bg-gray-200 rounded-2xl" />
      <div className="h-10 w-1/2 bg-gray-100 rounded-2xl self-end" />
      <div className="h-10 w-2/5 bg-gray-200 rounded-2xl" />
      {/* Composer */}
      <div className="mt-auto h-11 w-full bg-gray-100 rounded-full" />
    </div>
  )
}
