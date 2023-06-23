const { default: axios } = require("axios");

const loginCheck = async (setMyInfo, router) => {
  const noPermission = () => {
    setMyInfo(false);
    router.push("/login");
  };
  try{
    const { data } = await axios.get("/api/getUserInfo");
    console.log(data);
    if(!data) {
      noPermission();
      return;
    }
    setMyInfo(data);
  }
  catch{
    noPermission();
    return;
  }
};

export default loginCheck;