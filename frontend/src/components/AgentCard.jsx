import React from 'react';

const AgentCard = ({
  avatar,
  name,
  id,
  status,
  statusColor,
  rating,
  starIcon,
  activeDeliveries,
  onTimePercentage,
  location,
  locationIcon,
  deliveryColor = "text-blue-900",
  onTimeColor = "text-green-600"
}) => {
    const getStatusStyles = () => {
    switch (status.toLowerCase()) {
      case 'online':
        return 'text-green-600 bg-green-600 bg-opacity-10';
      case 'busy':
        return 'text-orange-600 bg-orange-600 bg-opacity-10';
      case 'offline':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };
  return (
    <article className="flex overflow-hidden flex-col grow justify-center p-px w-full bg-white rounded-xl border border-gray-100 border-solid shadow-[0px_1px_2px_rgba(0,0,0,0.05)] max-md:mt-6">
      <div className="p-6 w-full bg-black bg-opacity-0 max-md:px-5">
        <header className="flex gap-5 justify-between bg-black bg-opacity-0">
          <div className="flex gap-2 bg-black bg-opacity-0">
            <img
              src={avatar}
              alt={`${name} profile`}
              className="object-contain shrink-0 aspect-square w-[52px]"
            />
            <div className="flex flex-col px-px pb-2 my-auto bg-black bg-opacity-0">
              <h3 className="text-sm font-semibold leading-none text-gray-900">
                {name}
              </h3>
              <p className="self-start mt-2.5 text-xs leading-none text-gray-500">
                {id}
              </p>
            </div>
          </div>
          <span
            className={`px-3 pt-0.5 pb-2.5 my-auto text-xs font-medium whitespace-nowrap rounded-full ${getStatusStyles()}`}
            aria-label={`Status: ${status}`}
          >
            {status}
          </span>
        </header>
        <div className="mt-3 w-full bg-black bg-opacity-0">
          <div className="flex gap-10 w-full bg-black bg-opacity-0">
            <span className="text-sm leading-none text-gray-600">
              Rating
            </span>
            <div className="flex flex-1 gap-1 items-start py-0.5 bg-black bg-opacity-0">
              <div className="flex overflow-hidden justify-center items-center min-h-3.5">
                <img
                  src={starIcon}
                  alt="Star rating"
                  className="object-contain self-stretch my-auto aspect-[1.07] w-[15px]"
                />
              </div>
              <span className="text-sm font-medium leading-none text-black">
                {rating}
              </span>
            </div>
          </div>
          <div className="flex gap-5 justify-between items-start pb-2.5 mt-3 text-sm leading-none bg-black bg-opacity-0">
            <span className="text-gray-600">
              On-time %
            </span>
            <span className={`font-medium ${onTimeColor}`}>
              {onTimePercentage}
            </span>
          </div>
        </div>
        <footer className="pt-4 mt-4 w-full bg-black bg-opacity-0">
          <div className="flex gap-1 py-px w-full bg-black bg-opacity-0">
            <div className="flex overflow-hidden justify-center items-center self-start min-h-3">
              <img
                src={locationIcon}
                alt="Location"
                className="object-contain self-stretch my-auto aspect-[0.75] w-[9px]"
              />
              </div>
            <p className="grow shrink text-xs leading-none text-gray-500 w-[221px]">
              {location}
            </p>
          </div>
          </footer>
      </div>
    </article>
  );
};

export default AgentCard;