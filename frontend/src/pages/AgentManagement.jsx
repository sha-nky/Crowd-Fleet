import React from 'react';
import Header from '../components/Header';
import StatsCard from '../components/StatsCard';
import SearchFilters from '../components/SearchFilters';
import AgentCard from '../components/AgentCard';

const AgentManagement = () => {
  const statsData = [
    {
      icon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/547d92bf73f692b7f62ac1134e15ed7d2b09f822?placeholderIfAbsent=true",
      title: "Total Agents",
      value: "247",
      iconAlt: "Total agents icon"
    },
    {
      icon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/f10708c6dae8033f3c04da489222fcc3ad4ea843?placeholderIfAbsent=true",
      title: "Online Now",
      value: "186",
      iconAlt: "Online agents icon"
    },
    {
      icon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/4c0b7d6625c2a2cb49b71920b2dce3dc799a74f4?placeholderIfAbsent=true",
      title: "Active Deliveries",
      value: "142",
      iconAlt: "Active deliveries icon"
    },
    {
      icon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/8b7ae90ecd7a4b6e0ed7ef22c5ea0f4dff96fd9a?placeholderIfAbsent=true",
      title: "Avg Rating",
      value: "4.8",
      iconAlt: "Average rating icon"
    }
  ];

  const agentsData = [
    {
      avatar: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/1c084f3d7b0f6eb20d4e38179c03aa88d20e3ecf?placeholderIfAbsent=true",
      name: "Marcus Chen",
      id: "ID: #AG001",
      status: "Online",
      rating: "4.9",
      starIcon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/111ef9073b75e8ab8a8c35413cbce4639a7d8fd0?placeholderIfAbsent=true",
      activeDeliveries: "3",
      onTimePercentage: "96%",
      location: "Downtown District • 2 min ago",
      locationIcon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/8d9a9afd4c748a1fc8db7574cd952dbe1fdb1912?placeholderIfAbsent=true"
    },
    {
      avatar: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/948694383dd078737e316f3c1235a555ddec642a?placeholderIfAbsent=true",
      name: "Emma Rodriguez",
      id: "ID: #AG002",
      status: "Busy",
      rating: "4.7",
      starIcon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/d387f54b36a2fd4eab211a7c7a2904bb9258ca3e?placeholderIfAbsent=true",
      activeDeliveries: "5",
      onTimePercentage: "94%",
      location: "Business District • 5 min ago",
      locationIcon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/d97b4bce3c8e0dc32b2246627bf57e230bc7f75b?placeholderIfAbsent=true"
    },
    {
      avatar: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/21cad26baa2434846d3bead9e8b6ae8200199a80?placeholderIfAbsent=true",
      name: "David Kim",
      id: "ID: #AG003",
      status: "Offline",
      rating: "4.8",
      starIcon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/7de1291c2e77d67708793fa39af6ab8b34f1b23f?placeholderIfAbsent=true",
      activeDeliveries: "0",
      onTimePercentage: "98%",
      location: "Last seen: North Side • 2h ago",
      locationIcon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/0c8432c3016eaa2a63008b38b5892672705479f4?placeholderIfAbsent=true",
      deliveryColor: "text-gray-400"
    },
    {
      avatar: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/3ab753a5e32c011100084d55f3409fa32d68db1e?placeholderIfAbsent=true",
      name: "Lisa Thompson",
      id: "ID: #AG004",
      status: "Online",
      rating: "5.0",
      starIcon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/7dfbef5e9d06f897a5e8e7d0728d2e92b14c07f7?placeholderIfAbsent=true",
      activeDeliveries: "2",
      onTimePercentage: "99%",
      location: "Shopping Mall • 1 min ago",
      locationIcon: "https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/7fad61d121eb2b9312e83c29cf0a91000d609637?placeholderIfAbsent=true"
    }
  ];

  return (
    <div className="overflow-hidden bg-white rounded-lg border-2 border-gray-300 border-solid">
      <div className="flex flex-col w-full bg-gray-50 max-md:max-w-full">
        <Header />

        <main className="self-center px-8 py-8 w-full max-w-screen-xl bg-black bg-opacity-0 max-md:px-5 max-md:max-w-full">
          <section className="w-full bg-black bg-opacity-0 max-md:mr-0.5 max-md:max-w-full">
            <div className="flex flex-wrap gap-5 justify-between w-full bg-black bg-opacity-0 max-md:max-w-full">
              <div className="flex flex-col pr-3 pb-2 bg-black bg-opacity-0 max-md:max-w-full">
                <h1 className="self-start text-3xl font-bold leading-tight text-gray-900">
                  Agent Management
                </h1>
                <p className="mt-4 text-base text-gray-600 max-md:max-w-full">
                  Monitor and manage delivery agents' availability, performance, and activity
                </p>
              </div>
              <div className="flex gap-3 my-auto text-sm font-medium text-center bg-black bg-opacity-0">
                <button className="flex gap-3 px-4 py-3 text-gray-700 whitespace-nowrap bg-white rounded-lg border border-gray-300 border-solid focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                  <img
                    src="https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/a726521105f59c9b4745056e312f5b8cebcf58c5?placeholderIfAbsent=true"
                    alt=""
                    className="object-contain shrink-0 w-3.5 aspect-[0.82]"
                  />
                  Export
                </button>
                <button className="flex gap-3 px-4 py-3 text-white bg-blue-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2">
                  <img
                    src="https://api.builder.io/api/v1/image/assets/757fa9c07d2849f8acdd157c8f7fbc98/56de3f810a55fd8b52d5f7c505643d83490f9cb9?placeholderIfAbsent=true"
                    alt=""
                    className="object-contain shrink-0 w-3 aspect-[0.71]"
                  />
                  Add Agent
                </button>
                </div>
            </div>
          </section>

          <section className="p-0.5 mt-8 bg-black bg-opacity-0 max-md:max-w-full" aria-label="Statistics overview">
            <div className="flex gap-5 max-md:flex-col max-md:">
              {statsData.map((stat, index) => (
                <div key={index} className="w-3/12 max-md:ml-0 max-md:w-full">
                  <StatsCard {...stat} />
                  </div>
              ))}
            </div>
          </section>

          <SearchFilters />

          <section className="p-0.5 mt-8 bg-black bg-opacity-0 max-md:max-w-full" aria-label="Agent list">
            <div className="flex gap-5 max-md:flex-col max-md:">
              {agentsData.map((agent, index) => (
                <div key={index} className="w-3/12 max-md:ml-0 max-md:w-full">
                  <AgentCard {...agent} />
                </div>
                ))}
            </div>
          </section>

          <section className="flex flex-col items-center px-20 mt-7 text-sm font-medium text-center text-gray-700 bg-black bg-opacity-0 max-md:px-5 max-md:mr-0.5 max-md:max-w-full">
            <button className="flex flex-col justify-center px-7 py-4 max-w-full bg-white rounded-lg border border-gray-300 border-solid w-[172px] max-md:px-5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Load More Agents
            </button>
          </section>
          </main>
      </div>
    </div>
  );
};

export default AgentManagement;