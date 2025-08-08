import React from 'react';

const StatsCard = ({ icon, title, value, iconAlt }) => {
  return (
    <article className="flex flex-col justify-center p-6 mx-auto w-full bg-white rounded-xl border border-gray-100 border-solid shadow-[0px_1px_2px_rgba(0,0,0,0.05)] max-md:px-5 max-md:mt-6">
      <div className="flex gap-4 pr-12 bg-black bg-opacity-0 max-md:pr-5">
        <img
          src={icon}
          alt={iconAlt}
          className="object-contain shrink-0 my-auto w-8 aspect-square"
        />
        <div className="flex flex-col pb-3.5 bg-black bg-opacity-0">
          <h3 className="text-sm font-medium leading-none text-gray-600">
            {title}
          </h3>
          <p className="self-start mt-2 text-2xl font-bold leading-none text-gray-900">
            {value}
          </p>
        </div>
      </div>
    </article>
    );
};

export default StatsCard;