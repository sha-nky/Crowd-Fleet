import axios from "axios";

export const commonrequest = async (methods, url, body, header) => {
  console.log(`Making ${methods} request to ${url}`);
  console.log('Request headers:', header);
  console.log('Request body:', body);
  
  let config = {
    method: methods,
    url,
    headers: header
      ? header
      : {
          "Content-Type": "application/json",
        },
    data: body,
  };

  // axios instance
  return axios(config)
    .then((data) => {
      console.log('Response data:', data);
      return data;
    })
    .catch((error) => {
      console.error('Request error:', error);
      return error;
    });
};