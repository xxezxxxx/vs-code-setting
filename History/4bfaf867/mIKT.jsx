import { useState } from "react";
import "./App.css";

function App() {
  let post = "Test Blog";

  let [postTitles, changePostTitles] = useState([
    "남자 코트 추천",
    "남자 바지 추천",
    "남자 팬티 추천",
  ]);

  // let [postDate, setPostDate] = useState(["2월 24일", "2월 18일", "2월 12일"]);
  // let [postDetail, setPostDetail] = useState([
  //   "안녕하세요",
  //   "안녕못해요",
  //   "왜그러세요",
  // ]);

  let [inputText, setInputText] = useState("");

  let [openPost, setOpenPost] = useState(0);
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

  function actionModal(index) {
    if (modal) {
      setModal(false);
    } else {
      setModal(true);
    }
    setOpenPost(index);
  }

  function newTitle(text) {
    let newpostTitles = [...postTitles];
    newpostTitles.unshift(text);
    changePostTitles(newpostTitles);
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
                  <h4 onClick={() => actionModal(index)}>
                    {item}
                    <span
                      className="good"
                      onClick={(e) => {
                        e.stopPropagation();
                        actionGood(index);
                      }}
                    >
                      👍
                    </span>
                    {good[index]}
                  </h4>
                </div>
                <p>2월 17일 발행</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="input-box">
        <input
          type="text"
          onChange={(e) => {
            setInputText(e.target.value);
            console.log(inputText);
          }}
        />
        <button type="submit" onClick={newTitle}>
          글쓰기
        </button>
      </div>

      {modal ? (
        <Modal
          index={openPost}
          title={postTitles}
          date={"2월18일"}
          detail={"안녕하세요"}
          func={actionChange}
        ></Modal>
      ) : null}
    </div>
  );
}

function Modal(props) {
  return (
    <div className="modal">
      <h4>{props.title[props.index]}</h4>
      <p>{props.date}</p>
      <p>{props.detail}</p>
      <button onClick={props.func}>글 수정</button>
    </div>
  );
}

export default App;
