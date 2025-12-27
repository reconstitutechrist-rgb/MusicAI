import React from "react";
import {
  Genre,
  Mood,
  CollabStatus,
  CommunityFilters,
  GENRES,
  MOODS,
} from "../../types/community";

interface CollabFiltersProps {
  filters: CommunityFilters;
  onFilterChange: (filters: CommunityFilters) => void;
  showStatus?: boolean;
}

const CollabFilters: React.FC<CollabFiltersProps> = ({
  filters,
  onFilterChange,
  showStatus = true,
}) => {
  const statusOptions: { value: CollabStatus | "all"; label: string }[] = [
    { value: "all", label: "All Status" },
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ];

  const sortOptions: {
    value: CommunityFilters["sortBy"];
    label: string;
  }[] = [
    { value: "newest", label: "Newest" },
    { value: "popular", label: "Popular" },
    { value: "deadline", label: "Deadline" },
  ];

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search || ""}
          onChange={(e) =>
            onFilterChange({ ...filters, search: e.target.value })
          }
          className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Genre Filter */}
      <select
        value={filters.genre || "all"}
        onChange={(e) =>
          onFilterChange({
            ...filters,
            genre: e.target.value as Genre | "all",
          })
        }
        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
      >
        <option value="all">All Genres</option>
        {GENRES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>

      {/* Mood Filter */}
      <select
        value={filters.mood || "all"}
        onChange={(e) =>
          onFilterChange({
            ...filters,
            mood: e.target.value as Mood | "all",
          })
        }
        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
      >
        <option value="all">All Moods</option>
        {MOODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      {showStatus && (
        <select
          value={filters.status || "all"}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              status: e.target.value as CollabStatus | "all",
            })
          }
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
        >
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {/* Sort */}
      <select
        value={filters.sortBy || "newest"}
        onChange={(e) =>
          onFilterChange({
            ...filters,
            sortBy: e.target.value as CommunityFilters["sortBy"],
          })
        }
        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
      >
        {sortOptions.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CollabFilters;
