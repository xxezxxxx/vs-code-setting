import { useState } from "react";
import "./App.css";

function App() {
  let post = "Test Blog";
  let [postTitles, changePostTitles] = useState([
    "남자 코트 추천",
    "남자 바지 추천",
    "남자 팬티 추천",
  ]);

  let [good, changeGood] = useState([0, 0, 0]);

  let [modal, setModal] = useState(false);

  function actionGood(index) {
    let newGood = [...good];
    newGood[index] += 1;

    changeGood(newGood);
  }

  function actionChange() {
    let newPostTitles = [...postTitles];
    newPostTitles[0] = "여자 코트 추천";
    changePostTitles(newPostTitles);
  }

  function actionSort() {
    let newPostTitles = [...postTitles];
    newPostTitles.sort();
    changePostTitles(newPostTitles);
  }

  function actionModal() {
    if (modal) {
      setModal(false);
    } else {
      setModal(true);
    }
  }

  return (
    <div className="App">
      <div className="bg-black">
        <h4 style={{ fontSize: "22px" }}>{post}</h4>
      </div>
      <div>
        <button onClick={actionChange}>변경</button>
        <button onClick={actionSort}>정렬</button>
      </div>
      <div className="list-box">
        <div className="list">
          {postTitles.map(function (item, index) {
            return (
              <div key={index} className="list">
                <div className="title-box">
                  <h4 onClick={actionModal}>{item}</h4>
                  <span className="good" onClick={() => actionGood(index)}>
                    👍
                  </span>
                  {good[index]}
                </div>
                <p>2월 17일 발행</p>
              </div>
            );
          })}
        </div>
      </div>

      {modal ? (
        <Modal
          title={"알람"}
          date={"2월4일"}
          detail={"안녕하세요 모달입니다"}
        ></Modal>
      ) : null}
    </div>
  );
}

function Modal(props) {
  return (
    <div className="modal">
      <h4>{props.title}</h4>
      <p>{props.date}</p>
      <p>{props.detail}</p>
    </div>
  );
}

export default App;
