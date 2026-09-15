"use client";

export function DeleteButton() {
  return (
    <button
      type="submit"
      className="text-red-600 underline"
      onClick={(e) => {
        if (!confirm("Delete this post? This can't be undone.")) e.preventDefault();
      }}
    >
      Delete
    </button>
  );
}
