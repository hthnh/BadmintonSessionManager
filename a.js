// --- STATE MANAGEMENT ---
// Use const for variables that are not reassigned
const products = {
  rice: 5,
  milk: 10,
  bread: 3,
  snack: 1,
  sushi: 7,
};

const availableVouchers = {
  dis10: "10%",
  dangkhoadzs1tg: "free bread to play Minecraft",
};

// Initialize state from localStorage or with default values
let cartTotal = Number(localStorage.getItem("cartTotal")) || 0;
let userVouchers = JSON.parse(localStorage.getItem("userVouchers") || "[]");
let cartQuantities = JSON.parse(localStorage.getItem("cartQuantities")) || {
  rice: 0,
  milk: 0,
  bread: 0,
  snack: 0,
  sushi: 0,
};

let bill =
    "-------Hóa đơn của quý khách--------\n" +
    // Use (sl.item || 0) to prevent multiplying by undefined
    `Tiền mua sữa: ${products.milk * (sl.milk || 0)} $\n` +
    `Tiền mua bánh mì: ${products.bread * (sl.bread || 0)} $\n` +
    `Tiền mua cơm: ${products.rice * (sl.rice || 0)} $\n` +
    `Tiền mua snack: ${products.snack * (sl.snack || 0)} $\n` +
    `Tiền mua sushi: ${products.sushi * (sl.sushi || 0)} $\n` +
    "--------------------------------------\n" +
    `Tổng tiền là: ${total} $\n` +
    `Voucher hiện có: ${allvou.length} ${kco()}`;
  alert(bill);


function kco() {
  if (allvou.length === 0) return "";
  else {
    return `(${allvou})`;
  }
}

// Reset
function reset() {
  const slvou = allvou.length;
  if (confirm("Reset voucher luôn không ông cháu?")) {
    allvou = [];
    total = 0;
    for (let key in sl) sl[key] = 0;
    localStorage.setItem("sl", JSON.stringify(sl));
    localStorage.setItem("allvou", JSON.stringify(allvou));
    localStorage.setItem("total", total);
    alert(`Giỏ trống, Total: $${total}, Voucher: 0`);
  } else {
    for (let key in sl) sl[key] = 0;
    total = 0;
    alert(`Giỏ trống, Total: $${total}, Voucher: ${slvou}`);
    localStorage.setItem("total", total);
  }
}

// Add voucher
function vou(code) {
  const vous = {
    dis10: "10%",
    dangkhoadzs1tg: "free bread to play Minecraft",
  };

  if (code in vous) {
    allvou.push(vous[code]); // store voucher
    localStorage.setItem("allvou", JSON.stringify(allvou));
    alert(`You successfully have a voucher with ${vous[code]} discount`);
  } else {
    alert("Lua dao vl, tra máy cho mama đi ông cháu");
  }
}

// Cart + apply voucher
function carty() {
  let vouchers = JSON.parse(localStorage.getItem("allvou") || "[]");
  if (vouchers.length === 0) {
    alert(`No vouchers saved. Final price: $${total} and no bonus gift`);
    return;
  }

  if (confirm(`Apply all vouchers? (${vouchers.join(", ")})`)) {
    let unique = [...new Set(vouchers)];
    let usedVouchers = [];
    let bonusGifts = []; // to store freebies like "free bread"

    unique.forEach((v) => {
      if (v.includes("%")) {
        total -= (total * parseFloat(v)) / 100;
        usedVouchers.push(v);
      } else if (v.includes("$")) {
        total -= parseFloat(v);
        usedVouchers.push(v);
      } else {
        bonusGifts.push(v);
        usedVouchers.push(v);
      }
    });

    // Only remove the vouchers actually used
    vouchers = vouchers.filter((v) => !usedVouchers.includes(v));

    localStorage.setItem("allvou", JSON.stringify(vouchers));
    localStorage.setItem("total", total);
    alert(`Final price after vouchers: $${total.toFixed(2)}`);
    kcov(vouchers);
    if (bonusGifts.length > 0) {
      alert(`You also get these bonus gift(s): ${bonusGifts.join(", ")}`);
    }
  }
}

function kcov(vouchers) {
  if (vouchers.length > 0) {
    alert(`remaining voucher(s): ${vouchers.join(", ")}`);
  } else {
    alert(`k con voucher nao nua dau ban oi`);
  }
}
