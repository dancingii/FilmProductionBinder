import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import ProjectSelector from "../ProjectSelector";

// Display Name Editor Component
function DisplayNameEditor({ user }) {
  const [displayName, setDisplayName] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    loadDisplayName();
  }, [user]);

  const loadDisplayName = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setDisplayName(data?.display_name || user.email);
    } catch (error) {
      console.error("Error loading display name:", error);
      setDisplayName(user.email);
    }
  };

  const saveDisplayName = async () => {
    if (!displayName.trim()) {
      alert("Display name cannot be empty");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ display_name: displayName.trim() })
        .eq("id", user.id);

      if (error) throw error;
      setIsEditing(false);
    } catch (error) {
      alert("Error saving display name: " + error.message);
    }
    setLoading(false);
  };

  if (isEditing) {
    return (
      <span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") saveDisplayName();
            if (e.key === "Escape") setIsEditing(false);
          }}
          style={{
            padding: "4px 8px",
            fontSize: "14px",
            border: "1px solid white",
            borderRadius: "3px",
            backgroundColor: "transparent",
            color: "white",
            width: "150px",
          }}
          autoFocus
        />
        <button
          onClick={saveDisplayName}
          disabled={loading}
          style={{
            marginLeft: "5px",
            padding: "4px 8px",
            fontSize: "12px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "3px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Save
        </button>
        <button
          onClick={() => setIsEditing(false)}
          style={{
            marginLeft: "5px",
            padding: "4px 8px",
            fontSize: "12px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      style={{
        cursor: "pointer",
        textDecoration: "underline",
        textDecorationStyle: "dotted",
      }}
      title="Click to edit display name"
    >
      {displayName}
    </span>
  );
}

function AuthWrapper({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email,
          password: password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setError(error.message);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div style={{ fontSize: "18px", color: "#666" }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "40px",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            width: "100%",
            maxWidth: "400px",
            fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          }}
        >
          <h2
            style={{ textAlign: "center", marginBottom: "30px", color: "#333" }}
          >
            Film Production Manager
          </h2>

          <form onSubmit={handleAuth}>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "12px",
                    paddingRight: "45px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#666",
                  }}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: "#ffebee",
                  color: "#c62828",
                  padding: "12px",
                  borderRadius: "4px",
                  marginBottom: "20px",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                backgroundColor: isLogin ? "#2196F3" : "#f44336",
                color: "white",
                padding: "12px",
                border: "none",
                borderRadius: "4px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                marginBottom: "15px",
              }}
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                style={{
                  backgroundColor: "transparent",
                  color: "#2196F3",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  textDecoration: "underline",
                }}
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const TeamManagementModal = () => {
    const [teamMembers, setTeamMembers] = useState([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("editor");
    const [loading, setLoading] = useState(false);
    const [inviteError, setInviteError] = useState("");

    useEffect(() => {
      if (showTeamModal && selectedProject) {
        loadTeamMembers();
      }
    }, [showTeamModal, selectedProject]);

    const loadTeamMembers = async () => {
      try {
        // Get project members
        const { data: members, error: membersError } = await supabase
          .from("project_members")
          .select("id, user_id, role, created_at")
          .eq("project_id", selectedProject.id);

        if (membersError) throw membersError;

        if (!members || members.length === 0) {
          setTeamMembers([]);
          return;
        }

        // Get user emails for each member
        const memberIds = members.map((m) => m.user_id);
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, email")
          .in("id", memberIds);

        if (usersError) throw usersError;

        // Combine the data
        const membersWithEmails = members.map((member) => ({
          ...member,
          email: users.find((u) => u.id === member.user_id)?.email || "Unknown",
        }));

        console.log("Team members loaded:", membersWithEmails);
        setTeamMembers(membersWithEmails);
      } catch (error) {
        console.error("Error loading team members:", error);
        setTeamMembers([]);
      }
    };

    const inviteUser = async (e) => {
      e.preventDefault();
      setInviteError("");
      setLoading(true);

      try {
        // Look up user by email
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("email", inviteEmail.toLowerCase().trim())
          .single();

        if (userError || !userData) {
          setInviteError("No user found with that email address");
          setLoading(false);
          return;
        }

        // Check if already a member
        const { data: existingMember } = await supabase
          .from("project_members")
          .select("id")
          .eq("project_id", selectedProject.id)
          .eq("user_id", userData.id)
          .single();

        if (existingMember) {
          setInviteError("User is already a team member");
          setLoading(false);
          return;
        }

        // Add to project_members
        const { error: insertError } = await supabase
          .from("project_members")
          .insert([
            {
              project_id: selectedProject.id,
              user_id: userData.id,
              role: inviteRole,
            },
          ]);

        if (insertError) throw insertError;

        setInviteEmail("");
        setInviteRole("editor");
        loadTeamMembers();
        alert(`User invited successfully as ${inviteRole}!`);
      } catch (error) {
        setInviteError(error.message);
      }
      setLoading(false);
    };

    const removeMember = async (memberId) => {
      if (!confirm("Remove this team member?")) return;

      try {
        const { error } = await supabase
          .from("project_members")
          .delete()
          .eq("id", memberId);

        if (error) throw error;
        loadTeamMembers();
      } catch (error) {
        alert("Error removing team member: " + error.message);
      }
    };

    const changeRole = async (memberId, newRole) => {
      try {
        const { error } = await supabase
          .from("project_members")
          .update({ role: newRole })
          .eq("id", memberId);

        if (error) throw error;
        loadTeamMembers();
      } catch (error) {
        alert("Error changing role: " + error.message);
      }
    };

    if (!showTeamModal) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10001,
        }}
        onClick={() => setShowTeamModal(false)}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "8px",
            width: "600px",
            maxHeight: "80vh",
            overflow: "auto",
            fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginTop: 0 }}>Team Management</h2>
          <p style={{ color: "#666", fontSize: "14px" }}>
            Project: <strong>{selectedProject.name}</strong>
          </p>
          {/* Current Team Members */}
          <div style={{ marginBottom: "30px" }}>
            <h3>Team Members</h3>
            <div style={{ fontSize: "14px" }}>
              <div
                style={{
                  backgroundColor: "#f0f0f0",
                  padding: "10px",
                  marginBottom: "5px",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{user.email}</strong>
                  <span
                    style={{
                      marginLeft: "10px",
                      padding: "2px 8px",
                      backgroundColor: "#4CAF50",
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  >
                    OWNER (YOU)
                  </span>
                </div>
              </div>

              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  style={{
                    backgroundColor: "#f9f9f9",
                    padding: "10px",
                    marginBottom: "5px",
                    borderRadius: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{member.email || "Unknown"}</strong>
                    <select
                      value={member.role}
                      onChange={(e) => changeRole(member.id, e.target.value)}
                      style={{
                        marginLeft: "10px",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        backgroundColor:
                          member.role === "editor" ? "#2196F3" : "#FF9800",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="editor">EDITOR</option>
                      <option value="viewer">VIEWER</option>
                    </select>
                  </div>
                  <button
                    onClick={() => removeMember(member.id)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {teamMembers.length === 0 && (
                <p style={{ color: "#999", fontStyle: "italic" }}>
                  No team members yet. Invite someone below!
                </p>
              )}
            </div>
          </div>
          {/* Invite Form */}
          <div>
            <h3>Invite New Member</h3>
            <form onSubmit={inviteUser}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px" }}>
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  <option value="editor">Editor - Can edit all data</option>
                  <option value="viewer">Viewer - Read-only access</option>
                </select>
              </div>

              {inviteError && (
                <div
                  style={{
                    backgroundColor: "#ffebee",
                    color: "#c62828",
                    padding: "10px",
                    borderRadius: "4px",
                    marginBottom: "15px",
                    fontSize: "14px",
                  }}
                >
                  {inviteError}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    backgroundColor: "#4CAF50",
                    color: "white",
                    padding: "10px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Inviting..." : "Invite Member"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  style={{
                    backgroundColor: "#999",
                    color: "white",
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div
        style={{
          backgroundColor: "#2196F3",
          color: "white",
          padding: "10px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "14px",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
        }}
      >
        <div>
          Welcome, <DisplayNameEditor user={user} />
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {selectedProject && (
            <>
              <button
                onClick={() => setSelectedProject(null)}
                style={{
                  backgroundColor: "transparent",
                  color: "white",
                  border: "1px solid white",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Projects
              </button>
              {userRole === "owner" && (
                <button
                  onClick={() => setShowTeamModal(true)}
                  style={{
                    backgroundColor: "transparent",
                    color: "white",
                    border: "1px solid white",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Team
                </button>
              )}
            </>
          )}
          <button
            onClick={handleSignOut}
            style={{
              backgroundColor: "transparent",
              color: "white",
              border: "1px solid white",
              padding: "6px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {selectedProject ? (
        <React.Fragment>
          <TeamManagementModal />
          {React.cloneElement(children, { selectedProject, userRole, user })}
        </React.Fragment>
      ) : (
        <ProjectSelector
          user={user}
          onProjectSelected={(project) => {
            setSelectedProject(project);
            setUserRole(project.userRole || "owner");
          }}
        />
      )}
    </div>
  );
}

export default AuthWrapper;
