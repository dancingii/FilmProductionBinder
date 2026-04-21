import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabase";

/**
 * Shared presence hook for real-time collaboration awareness
 * Shows who is actively editing which items across all modules
 *
 * @param {string} projectId - Current project ID
 * @param {object} user - Current user object from Supabase auth
 * @param {string} moduleName - Name of the module (e.g., "todo", "cast_crew", "script")
 * @param {string} currentItemId - ID of item being edited (null when not editing)
 * @returns {object} - { otherUsers: array of other users' presence data }
 */
export function usePresence(projectId, user, moduleName, currentItemId = null) {
  const [otherUsers, setOtherUsers] = useState([]);
  const channelRef = useRef(null);
  const myPresenceRef = useRef({ itemId: null });

  useEffect(() => {
    if (!projectId || !user) return;

    // Load current user's display name
    const loadDisplayName = async () => {
      try {
        const { data } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", user.id)
          .single();

        return data?.display_name || user.email;
      } catch (error) {
        return user.email;
      }
    };

    const initPresence = async () => {
      const displayName = await loadDisplayName();

      // Create presence channel for this project
      const channel = supabase.channel(`presence_${projectId}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      // Track other users' presence
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const users = [];

          Object.keys(state).forEach((userId) => {
            if (userId !== user.id) {
              const presences = state[userId];
              if (presences && presences.length > 0) {
                const presence = presences[0];
                users.push({
                  userId,
                  displayName: presence.displayName,
                  module: presence.module,
                  itemId: presence.itemId,
                  color: presence.color,
                  timestamp: presence.timestamp,
                });
              }
            }
          });

          setOtherUsers(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // Initial presence - not editing anything yet
            await channel.track({
              userId: user.id,
              displayName,
              module: moduleName,
              itemId: null,
              color: getUserColor(user.id),
              timestamp: Date.now(),
            });
          }
        });

      channelRef.current = channel;
    };

    initPresence();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [projectId, user, moduleName]);

  // Update presence when editing item changes
  useEffect(() => {
    if (!channelRef.current || !user) return;

    const updatePresence = async () => {
      // Only update if the item actually changed
      if (myPresenceRef.current.itemId === currentItemId) return;

      myPresenceRef.current.itemId = currentItemId;

      try {
        const { data } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", user.id)
          .single();

        const displayName = data?.display_name || user.email;

        await channelRef.current.track({
          userId: user.id,
          displayName,
          module: moduleName,
          itemId: currentItemId,
          color: getUserColor(user.id),
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("Error updating presence:", error);
      }
    };

    updatePresence();
  }, [currentItemId, user, moduleName]);

  return { otherUsers };
}

/**
 * Generate consistent color for a user based on their ID
 */
function getUserColor(userId) {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B739",
    "#52B788",
    "#E76F51",
    "#2A9D8F",
  ];

  // Use hash of userId to pick consistent color
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
