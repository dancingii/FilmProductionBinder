import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

function ProjectSelector({ user, onProjectSelected }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProducer, setNewProducer] = useState("");
  const [newDirector, setNewDirector] = useState("");

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    try {
      // Get projects user owns
      const { data: ownedProjects, error: ownedError } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ownedError) throw ownedError;

      // Get projects user is a member of
      const { data: memberProjects, error: memberError } = await supabase
        .from("project_members")
        .select(
          `
          project_id,
          role,
          projects (*)
        `
        )
        .eq("user_id", user.id);

      if (memberError) throw memberError;

      // Combine both lists with role indicator and remove duplicates
      const allProjects = [
        ...(ownedProjects || []).map((p) => ({ ...p, userRole: "owner" })),
        ...(memberProjects || []).map((m) => ({
          ...m.projects,
          userRole: m.role,
        })),
      ];

      // Remove duplicates by project ID (prefer project_members role over user_id ownership)
      const uniqueProjects = allProjects.reduce((acc, project) => {
        const existing = acc.find((p) => p.id === project.id);
        if (!existing) {
          acc.push(project);
        }
        return acc;
      }, []);

      setProjects(uniqueProjects);
    } catch (error) {
      console.error("Error loading projects:", error);
    }
    setLoading(false);
  };

  const createProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert([
          {
            name: newProjectName.trim(),
            producer: newProducer.trim(),
            director: newDirector.trim(),
            user_id: user.id,
            created_by: user.id,
            settings: {
              filmTitle: newProjectName.trim(),
              producer: newProducer.trim(),
              director: newDirector.trim(),
            },
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setNewProjectName("");
      setNewProducer("");
      setNewDirector("");
      setCreating(false);
      loadProjects();
    } catch (error) {
      console.error("Error creating project:", error);
      setCreating(false);
    }
  };

  const deleteProject = async (projectId, projectName, e) => {
    e.stopPropagation(); // Prevent project card click

    const confirmed = window.confirm(
      `Are you sure you want to DELETE the project "${projectName}"?\n\nThis will permanently delete:\n- All scenes and script content\n- All stripboard and scheduling data\n- All cast, crew, and character data\n- All department data (props, makeup, wardrobe, etc.)\n- All budget and cost data\n- All shooting day and call sheet data\n\nThis action CANNOT be undone.`
    );

    if (!confirmed) return;

    try {
      // Delete the project (cascade deletes will handle all related data due to foreign key constraints)
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;

      // Remove from local state
      setProjects(projects.filter((p) => p.id !== projectId));

      alert(`Project "${projectName}" has been deleted successfully.`);
    } catch (error) {
      console.error("Error deleting project:", error);
      alert(`Failed to delete project: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "calc(100vh - 44px)",
          fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
        }}
      >
        <div style={{ fontSize: "18px", color: "#666" }}>
          Loading projects...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
        marginTop: "60px",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: "40px", color: "#333" }}>
        Select a Film Project
      </h1>

      {/* Create New Project */}
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          marginBottom: "30px",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#2196F3" }}>Create New Project</h2>
        <form onSubmit={createProject}>
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              Film Title *
            </label>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
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
          <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Producer
              </label>
              <input
                type="text"
                value={newProducer}
                onChange={(e) => setNewProducer(e.target.value)}
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
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Director
              </label>
              <input
                type="text"
                value={newDirector}
                onChange={(e) => setNewDirector(e.target.value)}
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
          </div>
          <button
            type="submit"
            disabled={creating}
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "12px 24px",
              border: "none",
              borderRadius: "4px",
              fontSize: "16px",
              cursor: creating ? "not-allowed" : "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </form>
      </div>

      {/* Existing Projects */}
      {projects.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#2196F3" }}>Your Projects</h2>
          <div style={{ display: "grid", gap: "15px" }}>
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => onProjectSelected(project)}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "20px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor: "#fafafa",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#f0f0f0";
                  e.target.style.borderColor = "#2196F3";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#fafafa";
                  e.target.style.borderColor = "#ddd";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                  }}
                >
                  <h3 style={{ margin: "0 0 8px 0", color: "#333" }}>
                    {project.name}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    {console.log(
                      "Project:",
                      project.name,
                      "Role:",
                      project.userRole
                    )}
                    {project.userRole && (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          backgroundColor:
                            project.userRole === "owner"
                              ? "#4CAF50"
                              : project.userRole === "editor"
                              ? "#2196F3"
                              : "#FF9800",
                          color: "white",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                        }}
                      >
                        {project.userRole}
                      </span>
                    )}
                    {project.userRole === "owner" && (
                      <button
                        onClick={(e) =>
                          deleteProject(project.id, project.name, e)
                        }
                        style={{
                          backgroundColor: "#f44336",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = "#d32f2f";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = "#f44336";
                        }}
                      >
                        DELETE
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: "14px", color: "#666" }}>
                  {project.producer && `Producer: ${project.producer} | `}
                  {project.director && `Director: ${project.director} | `}
                  Created: {new Date(project.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectSelector;
