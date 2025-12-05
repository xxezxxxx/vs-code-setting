$(".tab-button").on("click", function (e) {
  const index = $(this).index();
  $(".tab-button").removeClass("orange");
  $(".tab-button").eq(index).addClass("orange");
  $(".tab-content").removeClass("show");
  $(".tab-content").eq(index).addClass("show");

  // if (e.target == document.querySelectorAll(".tab-button")[0]) {
  //   $(".tab-button").eq(0).addClass("orange");
  //   console.log(e.target.dataset.id);
  // }
});

var car = ["소나타", 50000, "white"];
var car2 = { name: "소나타", price: [50000, 40000, 30000] };

document.getElementById(
  "product-and-price"
).innerText = `${car2.name} / ${car2.price[1]}`;

console.log(document.querySelector(".tab-button").dataset.id);

for (var i = 0; i < 3; i++) {
  console.log("안녕");
}
