import React from 'react';

const Header = () => {
  return (
    <header className="flex flex-col justify-center px-20 py-px w-full bg-white border border-b shadow-[0px_1px_2px_rgba(0,0,0,0.05)] max-md:px-5 max-md:max-w-full">
      <div className="px-8 w-full bg-black bg-opacity-0 max-md:px-5 max-md:max-w-full">
        <div className="flex flex-wrap gap-5 justify-between py-2.5 w-full bg-black bg-opacity-0 max-md:max-w-full">
          <div className="flex flex-wrap gap-8 my-auto whitespace-nowrap bg-black bg-opacity-0 max-md:max-w-full">
            <div className="px-px pb-3.5 my-auto text-2xl font-bold leading-none text-blue-900 bg-black bg-opacity-0">
              <h1>SmartCrowd</h1>
              </div>
            <nav
              className="flex flex-auto gap-9 items-start text-sm font-medium text-gray-500 bg-black bg-opacity-0"
              role="navigation"
              aria-label="Main navigation"
            >
                <a
                href="#dashboard"
                className="self-stretch px-1 pt-px pb-7 text-blue-900 border-b-2 border-blue-900 bg-black bg-opacity-0"
                aria-current="page"
              >
                Dashboard
              </a>
              <a href="#agents" className="leading-none">
                Agents
              </a>
              <a href="#deliveries" className="leading-none">
                Deliveries
              </a>
              <a href="#analytics" className="leading-none">
                Analytics
                </a>
            </nav>
          </div>
          <div className="flex gap-4 text-sm font-medium leading-none text-gray-700 bg-black bg-opacity-0">
            <button
              aria-label="Notifications"
              className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
                <img
                src="https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/58efc70068988086b858f780f600931ebb787513?placeholderIfAbsent=true"
                alt="Notifications"
                className="object-contain shrink-0 w-8 aspect-[0.73]"
              />
            </button>
            <div className="flex gap-3 my-auto bg-black bg-opacity-0">
              <img
                src="https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/73c03b79705c2d124ad1c299c5685fdd1780d7dd?placeholderIfAbsent=true"
                alt="Sarah Johnson profile"
                className="object-contain shrink-0 w-8 rounded-full aspect-square"
                />
              <span className="self-start basis-auto">
                Sarah Johnson
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;