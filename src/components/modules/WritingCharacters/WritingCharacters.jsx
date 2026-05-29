import React from "react";
import WritingCharactersPanel from "./WritingCharactersPanel";

// Separate from the production Characters module.
// Receives all state and handlers from WritingScript.
function WritingCharacters(props) {
  return <WritingCharactersPanel {...props} />;
}

export default WritingCharacters;
