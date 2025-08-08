import React from 'react';

const SearchFilters = () => {
  return (
    <section className="flex flex-col justify-center p-6 mt-7 w-full bg-white rounded-xl border border-gray-100 border-solid shadow-[0px_1px_2px_rgba(0,0,0,0.05)] max-md:px-5 max-md:mr-0.5 max-md:max-w-full">
      <div className="flex flex-wrap gap-5 justify-between w-full bg-black bg-opacity-0 max-md:max-w-full">
        <div className="flex flex-wrap gap-4 bg-black bg-opacity-0">
          <div className="bg-black bg-opacity-0">
            <div className="flex gap-3 px-3 py-3.5 w-full bg-white rounded-lg border border-gray-300 border-solid">
              <div className="flex overflow-hidden justify-center items-center self-start min-h-4">
                <img
                  src="https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/9ee46d841792188f1b6779943d87d23702e683a3?placeholderIfAbsent=true"
                  alt="Search"
                  className="object-contain self-stretch my-auto w-4 aspect-square"
                />
              </div>
              <input
                type="text"
                placeholder="Search agents..."
                className="grow shrink text-base text-gray-400 w-[201px] bg-transparent border-none outline-none focus:text-gray-900"
                aria-label="Search agents"
              />
            </div>
            </div>
          <div className="relative">
            <select
              className="flex gap-3 px-2.5 py-2 text-base text-black bg-white rounded-lg border border-gray-300 border-solid appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by status"
            >
              <option>All Status</option>
              <option>Online</option>
              <option>Busy</option>
              <option>Offline</option>
            </select>
            <img
              src="https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/1897a06ace86a0ff7df17720cbb3e9b8fd0503ee?placeholderIfAbsent=true"
              alt=""
              className="absolute right-2 top-1/2 transform -translate-y-1/2 object-contain shrink-0 aspect-square w-[26px] pointer-events-none"
            />
          </div>
          <div className="relative">
            <select
              className="flex gap-3 px-2.5 py-2 text-base text-black bg-white rounded-lg border border-gray-300 border-solid appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by rating"
            >
              <option>All Ratings</option>
              <option>5 Stars</option>
              <option>4+ Stars</option>
              <option>3+ Stars</option>
            </select>
            <img
              src="https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/1897a06ace86a0ff7df17720cbb3e9b8fd0503ee?placeholderIfAbsent=true"
              alt=""
              className="absolute right-2 top-1/2 transform -translate-y-1/2 object-contain shrink-0 aspect-square w-[26px] pointer-events-none"
            />
          </div>
        </div>
        <button
          className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          aria-label="Additional options"
        >
          <img
            src="https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/53c22ee04c6cb4baa5bbee4b9031f6bac853c689?placeholderIfAbsent=true"
            alt="Options"
            className="object-contain shrink-0 self-start aspect-[1.8] w-[72px]"
          />
        </button>
      </div>
      </section>
  );
};

export default SearchFilters;